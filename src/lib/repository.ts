import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocsFromServer,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import type { Item, Opname, OpnameEntry, Transaction, UserProfile } from "../types";
import { nowISO } from "./date";
import { db } from "./firebase";
import { todayStr } from "./date";
import { stockDelta, type TxData } from "./stock";

const itemsCol = collection(db, "items");
const txCol = collection(db, "transactions");
const usersCol = collection(db, "users");
const opnameCol = collection(db, "opname");

export interface SnapshotMeta {
  /** true jika data berasal dari cache lokal dan belum terkonfirmasi server. */
  fromCache: boolean;
  /** true jika ada perubahan lokal yang belum terkirim ke server. */
  hasPendingWrites: boolean;
}

export function subscribeItems(
  onData: (items: Item[], meta: SnapshotMeta) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(itemsCol, orderBy("name")),
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Item),
        snap.metadata,
      ),
    onError,
  );
}

export function subscribeTransactions(
  onData: (txs: Transaction[], meta: SnapshotMeta) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(txCol, orderBy("createdAt", "desc")),
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction),
        snap.metadata,
      ),
    onError,
  );
}

export type ItemData = Omit<Item, "id" | "createdAt" | "lastTxId">;

export async function addItem({ expiry, ...data }: ItemData): Promise<void> {
  await addDoc(itemsCol, { ...data, ...(expiry ? { expiry } : {}), createdAt: nowISO() });
}

/**
 * Stok hanya ditulis jika disertakan, agar tidak menimpa transaksi dari perangkat lain.
 * ED kosong ("" atau undefined) yang disertakan berarti ED dihapus.
 */
export async function updateItem(id: string, data: Partial<ItemData>): Promise<void> {
  const { expiry, ...rest } = data;
  await updateDoc(doc(itemsCol, id), { ...rest, ...("expiry" in data ? { expiry: expiry || deleteField() } : {}) });
}

/** Perbarui atau hapus (null) ED barang. */
export function setExpiry(id: string, expiry: string | null): Promise<void> {
  return updateDoc(doc(itemsCol, id), { expiry: expiry ?? deleteField() });
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(doc(itemsCol, id));
}

/**
 * Simpan transaksi baru beserta perubahan stoknya dalam satu batch.
 *
 * Memakai writeBatch + increment() (bukan runTransaction) supaya:
 * - tetap bisa dicatat saat offline dan terkirim otomatis saat sinyal kembali;
 * - stok dan catatan transaksi tersimpan bersamaan atau tidak sama sekali;
 * - dua perangkat yang menyimpan bersamaan tidak saling menimpa stok.
 * `lastTxId` dipakai aturan keamanan untuk memastikan stok hanya berubah lewat transaksi.
 *
 * Jika `voidsTxId` diisi, transaksi asli ikut ditandai sudah dibatalkan.
 * Mengembalikan id transaksi baru (langsung, tanpa menunggu server) dan Promise penyimpanannya.
 * Tidak perlu menunggu Promise-nya: saat offline, Promise baru selesai setelah tersinkron,
 * padahal perubahan sudah langsung berlaku di cache lokal.
 */
export function saveTransaction(
  data: TxData,
  /** ED barang yang ikut berubah: string = ED baru, null = dikosongkan, undefined = tidak berubah. */
  expiry?: string | null,
): { id: string; done: Promise<void> } {
  const batch = writeBatch(db);
  const txRef = doc(txCol);
  batch.set(txRef, { ...data, createdAt: nowISO() });
  batch.update(doc(itemsCol, data.itemId), {
    stock: increment(stockDelta(data.type, data.qty)),
    lastTxId: txRef.id,
    ...(expiry === undefined ? {} : { expiry: expiry ?? deleteField() }),
  });
  if (data.voidsTxId) batch.update(doc(txCol, data.voidsTxId), { voidedBy: txRef.id });
  return { id: txRef.id, done: batch.commit() };
}

export function subscribeProfile(
  email: string,
  onData: (profile: UserProfile | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(usersCol, email),
    (snap) => onData(snap.exists() ? ({ email: snap.id, ...snap.data() } as UserProfile) : null),
    onError,
  );
}

export function subscribeUsers(onData: (users: UserProfile[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    usersCol,
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ email: d.id, ...d.data() }) as UserProfile)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    onError,
  );
}

export function saveUser({ email, ...data }: UserProfile): Promise<void> {
  return setDoc(doc(usersCol, email.trim().toLowerCase()), { ...data, createdAt: data.createdAt ?? nowISO() });
}

/** Dicatat atas nama siapa (dari akun yang login). */
export interface Actor {
  name: string;
  email: string;
}

/** Data transaksi penyesuaian agar stok barang menjadi `target`; null jika tidak ada selisih. */
function adjustmentTx(
  item: Pick<Item, "id" | "name" | "stock">,
  target: number,
  by: Actor,
  adjust: "opname" | "koreksi",
  note: string,
): TxData | null {
  const diff = target - item.stock;
  if (diff === 0) return null;
  return {
    itemId: item.id,
    itemName: item.name,
    type: diff > 0 ? "masuk" : "keluar",
    qty: Math.abs(diff),
    date: todayStr(),
    note,
    operator: by.name,
    email: by.email,
    adjust,
  };
}

/** Koreksi stok oleh admin (dari form Ubah barang): dicatat sebagai transaksi penyesuaian, bukan diubah langsung. */
export function correctStock(item: Item, target: number, by: Actor): Promise<void> | null {
  const data = adjustmentTx(item, target, by, "koreksi", `Koreksi stok: ${item.stock} → ${target}`);
  return data ? saveTransaction(data).done : null;
}

/**
 * Simpan stok opname: dokumen riwayat opname + satu transaksi penyesuaian untuk tiap barang yang selisih.
 * Dipecah per beberapa batch karena batas 500 operasi per batch; batch pertama memuat dokumen opname.
 */
export async function saveOpname(entries: OpnameEntry[], items: Item[], by: Actor, note: string): Promise<void> {
  const opnameRef = doc(opnameCol);
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  for (const e of entries) {
    const item = items.find((i) => i.id === e.itemId);
    if (!item) continue;
    const data = adjustmentTx(
      item,
      e.counted,
      by,
      "opname",
      `Stok opname: hitung fisik ${e.counted}, catatan ${item.stock}`,
    );
    if (!data) continue;
    ops.push((b) => {
      const txRef = doc(txCol);
      b.set(txRef, { ...data, opnameId: opnameRef.id, createdAt: nowISO() });
      b.update(doc(itemsCol, item.id), { stock: increment(stockDelta(data.type, data.qty)), lastTxId: txRef.id });
    });
  }
  const commits: Promise<void>[] = [];
  const CHUNK = 200;
  for (let i = 0; i === 0 || i < ops.length; i += CHUNK) {
    const b = writeBatch(db);
    if (i === 0) {
      b.set(opnameRef, { date: todayStr(), operator: by.name, email: by.email, note, entries, createdAt: nowISO() });
    }
    ops.slice(i, i + CHUNK).forEach((op) => op(b));
    commits.push(b.commit());
  }
  await Promise.all(commits);
}

export function subscribeOpnames(onData: (list: Opname[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(opnameCol, orderBy("createdAt", "desc")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Opname)),
    onError,
  );
}

/**
 * Ambil seluruh isi database langsung dari server untuk cadangan (butuh sinyal & akun admin).
 * Tidak memakai cache supaya cadangan pasti lengkap dan terbaru.
 */
export async function fetchAllForBackup(): Promise<{
  items: Item[];
  transactions: Transaction[];
  users: UserProfile[];
  opname: Opname[];
}> {
  const [items, transactions, users, opname] = await Promise.all([
    getDocsFromServer(itemsCol),
    getDocsFromServer(txCol),
    getDocsFromServer(usersCol),
    getDocsFromServer(opnameCol),
  ]);
  return {
    items: items.docs.map((d) => ({ id: d.id, ...d.data() }) as Item),
    transactions: transactions.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction),
    users: users.docs.map((d) => ({ email: d.id, ...d.data() }) as UserProfile),
    opname: opname.docs.map((d) => ({ id: d.id, ...d.data() }) as Opname),
  };
}

export interface BackupMeta {
  lastBackupAt: string;
  by: string;
}

const backupMetaRef = doc(db, "meta", "backup");

export function subscribeBackupMeta(onData: (meta: BackupMeta | null) => void): Unsubscribe {
  return onSnapshot(
    backupMetaRef,
    (snap) => onData(snap.exists() ? (snap.data() as BackupMeta) : null),
    () => onData(null),
  );
}

export function setBackupMeta(meta: BackupMeta): Promise<void> {
  return setDoc(backupMetaRef, meta);
}

/** Terapkan perubahan tanda darurat dan perbaikan satuan sekaligus (khusus admin). */
export function applyDaruratChanges(
  kritis: { id: string; kritis: boolean }[],
  units: { id: string; unit: string }[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const c of kritis) batch.update(doc(itemsCol, c.id), { kritis: c.kritis });
  for (const u of units) batch.update(doc(itemsCol, u.id), { unit: u.unit });
  return batch.commit();
}

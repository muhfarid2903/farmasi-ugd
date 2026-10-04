import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import type { Item, Transaction, UserProfile } from "../types";
import { nowISO } from "./date";
import { db } from "./firebase";
import { stockDelta, type TxData } from "./stock";

const itemsCol = collection(db, "items");
const txCol = collection(db, "transactions");
const usersCol = collection(db, "users");

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

export async function addItem(data: ItemData): Promise<void> {
  await addDoc(itemsCol, { ...data, createdAt: nowISO() });
}

/** Stok hanya ditulis jika disertakan, agar tidak menimpa transaksi dari perangkat lain. */
export async function updateItem(id: string, data: Partial<ItemData>): Promise<void> {
  await updateDoc(doc(itemsCol, id), data);
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
 * Jika `voids` diisi, transaksi asli ikut ditandai sudah dibatalkan.
 * Tidak perlu menunggu Promise-nya: saat offline, Promise baru selesai setelah tersinkron,
 * padahal perubahan sudah langsung berlaku di cache lokal.
 */
export function saveTransaction(data: TxData): Promise<void> {
  const batch = writeBatch(db);
  const txRef = doc(txCol);
  batch.set(txRef, { ...data, createdAt: nowISO() });
  batch.update(doc(itemsCol, data.itemId), { stock: increment(stockDelta(data.type, data.qty)), lastTxId: txRef.id });
  if (data.voidsTxId) batch.update(doc(txCol, data.voidsTxId), { voidedBy: txRef.id });
  return batch.commit();
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

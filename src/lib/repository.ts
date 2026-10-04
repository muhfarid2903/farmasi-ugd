import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import type { Item, Transaction } from "../types";
import { nowISO } from "./date";
import { stockChanges } from "./stock";
import { db } from "./firebase";

const itemsCol = collection(db, "items");
const txCol = collection(db, "transactions");

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

export type ItemData = Omit<Item, "id" | "createdAt">;

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

export type TxData = Omit<Transaction, "id" | "createdAt">;

/**
 * Simpan transaksi baru, atau edit transaksi lama, beserta perubahan stoknya.
 *
 * Memakai writeBatch + increment() (bukan runTransaction) supaya:
 * - tetap bisa dicatat saat offline dan terkirim otomatis saat sinyal kembali;
 * - stok dan catatan transaksi tersimpan bersamaan atau tidak sama sekali;
 * - dua perangkat yang menyimpan bersamaan tidak saling menimpa stok.
 *
 * Tidak menunggu konfirmasi server: saat offline, Promise dari commit() baru selesai
 * setelah tersinkron, padahal perubahan sudah langsung berlaku di cache lokal.
 */
export function saveTransaction(data: TxData, prev?: Transaction): Promise<void> {
  const batch = writeBatch(db);
  for (const [itemId, delta] of stockChanges(data, prev)) {
    batch.update(doc(itemsCol, itemId), { stock: increment(delta) });
  }
  if (prev) batch.update(doc(txCol, prev.id), { ...data });
  else batch.set(doc(txCol), { ...data, createdAt: nowISO() });
  return batch.commit();
}

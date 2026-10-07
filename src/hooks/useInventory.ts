import { useEffect, useMemo, useState } from "react";
import type { Item, SyncStatus, Transaction } from "../types";
import { activeItems } from "../lib/merge";
import { subscribeItems, subscribeTransactions, type SnapshotMeta } from "../lib/repository";

const initialMeta: SnapshotMeta = { fromCache: true, hasPendingWrites: false };

/**
 * Data item & transaksi real-time dari Firestore, beserta status sinkronisasi.
 * `items` hanya barang aktif; `allItems` juga memuat salinan yang sudah digabung (untuk rekap & riwayat).
 */
export function useInventory() {
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const [itemsMeta, setItemsMeta] = useState(initialMeta);
  const [txMeta, setTxMeta] = useState(initialMeta);
  const [error, setError] = useState<string | null>(null);
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onError = (e: Error) => {
      console.error(e);
      setError(e.message);
      setItemsLoaded(true);
      setTxLoaded(true);
    };
    const u1 = subscribeItems((data, meta) => {
      setItems(data);
      setItemsMeta(meta);
      setItemsLoaded(true);
    }, onError);
    const u2 = subscribeTransactions((data, meta) => {
      setTransactions(data);
      setTxMeta(meta);
      setTxLoaded(true);
    }, onError);
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    const update = () => setBrowserOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const active = useMemo(() => activeItems(items), [items]);
  const loading = !itemsLoaded || !txLoaded;
  let syncStatus: SyncStatus;
  if (loading) syncStatus = "loading";
  else if (itemsMeta.hasPendingWrites || txMeta.hasPendingWrites) syncStatus = "pending";
  else if (!browserOnline || itemsMeta.fromCache || txMeta.fromCache) syncStatus = "offline";
  else syncStatus = "online";

  return { items: active, allItems: items, transactions, loading, syncStatus, error };
}

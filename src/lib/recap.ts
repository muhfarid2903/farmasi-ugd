import type { Item, Transaction } from "../types";
import { stockDelta } from "./stock";

export interface RecapRow {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  start: number;
  masuk: number;
  keluar: number;
  /** Penyesuaian bersih (opname/koreksi), bisa negatif. */
  adjust: number;
  end: number;
}

/**
 * Rekap per barang untuk satu bulan ("YYYY-MM"), dihitung mundur dari stok saat ini:
 * stok akhir bulan = stok sekarang − perubahan setelah bulan itu; stok awal = akhir − perubahan dalam bulan.
 *
 * Transaksi yang dibatalkan beserta pembatalannya dalam bulan yang sama tidak dihitung sebagai masuk/keluar
 * (saling meniadakan). Penyesuaian (opname/koreksi) masuk kolom tersendiri.
 */
export function monthlyRecap(items: Item[], transactions: Transaction[], month: string): RecapRow[] {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const inMonth = (t: Transaction) => t.date.startsWith(month);
  const after = (t: Transaction) => t.date.slice(0, 7) > month;

  /** Batal-membatalkan di bulan yang sama: abaikan keduanya untuk kolom masuk/keluar. */
  const cancelledPair = (t: Transaction) => {
    const other = t.voidedBy ? byId.get(t.voidedBy) : t.voidsTxId ? byId.get(t.voidsTxId) : undefined;
    return !!other && inMonth(other);
  };

  const rows = new Map<string, RecapRow>();
  const row = (id: string, fallbackName: string) => {
    let r = rows.get(id);
    if (!r) {
      const item = items.find((i) => i.id === id);
      r = {
        itemId: id,
        itemName: item?.name ?? `${fallbackName} (sudah dihapus)`,
        category: item?.category ?? "-",
        unit: item?.unit ?? "",
        start: 0,
        masuk: 0,
        keluar: 0,
        adjust: 0,
        end: item?.stock ?? 0,
      };
      rows.set(id, r);
    }
    return r;
  };
  for (const item of items) row(item.id, item.name);

  // Stok akhir bulan: batalkan semua perubahan yang terjadi setelah bulan itu
  for (const t of transactions) if (after(t)) row(t.itemId, t.itemName).end -= stockDelta(t.type, t.qty);

  for (const r of rows.values()) r.start = r.end;
  for (const t of transactions) {
    if (!inMonth(t)) continue;
    const r = row(t.itemId, t.itemName);
    const d = stockDelta(t.type, t.qty);
    r.start -= d;
    if (t.adjust) r.adjust += d;
    else if (cancelledPair(t)) continue;
    else if (t.type === "masuk") r.masuk += t.qty;
    else r.keluar += t.qty;
  }
  return [...rows.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
}

/** Hanya barang yang punya stok atau pergerakan di bulan itu. */
export function activeRows(rows: RecapRow[]): RecapRow[] {
  return rows.filter((r) => r.start || r.masuk || r.keluar || r.adjust || r.end);
}

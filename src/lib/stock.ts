import { todayStr } from "./date";
import { expiryStatus } from "./expiry";
import type { Item, Transaction, TxType } from "../types";

/** Item dengan minimum stok 0 dianggap tidak dipantau, jadi tidak masuk peringatan. */
export function isLowStock(item: Pick<Item, "stock" | "minStock">): boolean {
  return item.minStock > 0 && item.stock <= item.minStock;
}

/** Pengaruh sebuah transaksi terhadap stok: masuk menambah, keluar mengurangi. */
export function stockDelta(type: TxType, qty: number): number {
  return type === "masuk" ? qty : -qty;
}

export interface TxInput {
  itemId: string;
  type: TxType;
  qty: number;
}

/** Perubahan stok per item yang dibutuhkan untuk menyimpan transaksi baru. */
export function stockChanges(tx: TxInput): Map<string, number> {
  return new Map([[tx.itemId, stockDelta(tx.type, tx.qty)]]);
}

/** Data transaksi baru (tanpa id & createdAt). */
export type TxData = Omit<Transaction, "id" | "createdAt" | "voidedBy">;

/** Apakah transaksi ini masih bisa dibatalkan oleh pengguna tersebut. */
export function canVoid(tx: Transaction, user: { email: string; role: string }): boolean {
  if (tx.voidedBy || tx.voidsTxId) return false;
  return user.role === "admin" || tx.email === user.email;
}

/**
 * Transaksi pembatalan: item dan jumlah sama, tipe berlawanan, sehingga stok kembali seperti semula.
 * Transaksi asli tetap tersimpan sebagai jejak.
 */
export function voidTxData(
  orig: Transaction,
  by: { name: string; email: string },
  today: string,
  reason: string,
): TxData {
  const r = reason.trim();
  return {
    itemId: orig.itemId,
    itemName: orig.itemName,
    type: orig.type === "masuk" ? "keluar" : "masuk",
    qty: orig.qty,
    date: today,
    note: `Pembatalan transaksi ${orig.date}${r ? ` — ${r}` : ""}`,
    operator: by.name,
    email: by.email,
    voidsTxId: orig.id,
  };
}

/**
 * Cek apakah perubahan stok membuat stok item mana pun negatif.
 * Mengembalikan pesan kesalahan, atau null jika aman.
 */
export function validateStockChanges(changes: Map<string, number>, items: Item[]): string | null {
  for (const [id, delta] of changes) {
    const item = items.find((i) => i.id === id);
    if (!item) return "Barang ini tidak ditemukan. Mungkin sudah dihapus admin.";
    if (item.stock + delta < 0) {
      return `Stok ${item.name} tinggal ${item.stock} ${item.unit}, tidak cukup untuk ${-delta} ${item.unit}. Periksa lagi jumlahnya.`;
    }
  }
  return null;
}

export interface TxForm {
  itemId: string;
  type: TxType;
  qty: string;
  date: string;
  note: string;
}

/** Validasi isian form transaksi. Mengembalikan pesan kesalahan, atau null jika valid. */
export function validateTxForm(form: TxForm): string | null {
  if (!form.itemId) return "Pilih dulu barangnya.";
  const qty = Number(form.qty);
  if (!form.qty || !Number.isInteger(qty) || qty <= 0) return "Jumlah harus angka bulat, paling sedikit 1.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return "Tanggal belum diisi.";
  return null;
}

export interface ItemForm {
  name: string;
  category: Item["category"];
  unit: string;
  stock: string;
  minStock: string;
  kritis: boolean;
  /** "YYYY-MM" atau "" */
  expiry: string;
}

/** Validasi isian form item. Stok 0 valid; yang ditolak hanya kolom kosong. */
export function validateItemForm(form: ItemForm): string | null {
  if (!form.name.trim() || form.stock === "" || form.minStock === "") return "Semua field wajib diisi";
  const stock = Number(form.stock);
  const minStock = Number(form.minStock);
  if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(minStock) || minStock < 0) {
    return "Stok dan minimum stok harus bilangan bulat ≥ 0";
  }
  return null;
}

/** Transaksi dalam periode: per bulan ("YYYY-MM") atau rentang tanggal inklusif. */
export function filterByPeriod(
  txs: Transaction[],
  period: { mode: "bulan"; month: string } | { mode: "rentang"; from: string; to: string },
): Transaction[] {
  return period.mode === "bulan"
    ? txs.filter((t) => t.date?.startsWith(period.month))
    : txs.filter((t) => t.date && t.date >= period.from && t.date <= period.to);
}

export type StockStatus = "habis" | "hampir" | "cukup";

/** Status stok dalam kata sehari-hari. Item tanpa batas minimum hanya bisa "habis" atau "cukup". */
export function stockStatus(item: Pick<Item, "stock" | "minStock">): StockStatus {
  if (item.stock <= 0) return "habis";
  return isLowStock(item) ? "hampir" : "cukup";
}

export type StockFilter = "semua" | "darurat" | "hampir" | "habis" | "ed";

export function filterItems(items: Item[], filter: StockFilter, category: string, today = todayStr()): Item[] {
  return items.filter(
    (i) =>
      (category === "Semua" || i.category === category) &&
      (filter === "semua" ||
        (filter === "darurat" && i.kritis) ||
        (filter === "hampir" && stockStatus(i) === "hampir") ||
        (filter === "habis" && stockStatus(i) === "habis") ||
        (filter === "ed" && i.stock > 0 && !!i.expiry && expiryStatus(i.expiry, today) !== "aman")),
  );
}

export type TxPeriod = "hari" | "minggu" | "semua";

/** Transaksi hari ini, 7 hari terakhir (termasuk hari ini), atau semua. */
export function filterTxPeriod(txs: Transaction[], period: TxPeriod, today: string, weekAgo: string): Transaction[] {
  if (period === "hari") return txs.filter((t) => t.date === today);
  if (period === "minggu") return txs.filter((t) => t.date > weekAgo && t.date <= today);
  return txs;
}

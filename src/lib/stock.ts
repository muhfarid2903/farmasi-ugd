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

/**
 * Perubahan stok per item yang dibutuhkan untuk menyimpan transaksi baru,
 * atau mengedit transaksi lama (efek lama dibalik, efek baru diterapkan).
 * Item yang perubahannya nol tidak disertakan.
 */
export function stockChanges(next: TxInput, prev?: TxInput): Map<string, number> {
  const changes = new Map<string, number>();
  const add = (id: string, delta: number) => changes.set(id, (changes.get(id) ?? 0) + delta);
  if (prev) add(prev.itemId, -stockDelta(prev.type, prev.qty));
  add(next.itemId, stockDelta(next.type, next.qty));
  for (const [id, delta] of changes) if (delta === 0) changes.delete(id);
  return changes;
}

/**
 * Cek apakah perubahan stok membuat stok item mana pun negatif.
 * Mengembalikan pesan kesalahan, atau null jika aman.
 */
export function validateStockChanges(changes: Map<string, number>, items: Item[]): string | null {
  for (const [id, delta] of changes) {
    const item = items.find((i) => i.id === id);
    if (!item) return "Item tidak ditemukan di database";
    const result = item.stock + delta;
    if (result < 0) {
      return delta < 0 && changes.size === 1
        ? `Stok tidak cukup! Tersedia: ${item.stock} ${item.unit}`
        : `Perubahan ini membuat stok ${item.name} menjadi negatif (${result}). Barang tersebut sudah terpakai.`;
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
  operator: string;
}

/** Validasi isian form transaksi. Mengembalikan pesan kesalahan, atau null jika valid. */
export function validateTxForm(form: TxForm): string | null {
  if (!form.itemId || !form.qty || !form.operator.trim()) return "Item, jumlah, dan petugas wajib diisi";
  const qty = Number(form.qty);
  if (!Number.isInteger(qty) || qty <= 0) return "Jumlah harus bilangan bulat lebih dari 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return "Tanggal wajib diisi";
  return null;
}

export interface ItemForm {
  name: string;
  category: Item["category"];
  unit: string;
  stock: string;
  minStock: string;
  kritis: boolean;
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

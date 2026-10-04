export const CATEGORIES = ["Obat", "Alat Medis", "Cairan Infus", "Bahan Habis Pakai", "Lainnya"] as const;
export type Category = (typeof CATEGORIES)[number];

export const UNITS = [
  "tablet",
  "ampul",
  "kapsul",
  "botol",
  "buah",
  "tube",
  "roll",
  "box",
  "sachet",
  "bag",
  "kotak",
  "bungkus",
  "pasang",
  "strip",
  "patch",
  "test",
  "paket",
  "blister",
  "suppositoria",
] as const;

export type TxType = "masuk" | "keluar";

/** Dokumen di koleksi `items`. */
export interface Item {
  id: string;
  name: string;
  category: Category;
  unit: string;
  stock: number;
  minStock: number;
  kritis: boolean;
  createdAt?: string;
}

/** Dokumen di koleksi `transactions`. `date` berformat YYYY-MM-DD (tanggal lokal). */
export interface Transaction {
  id: string;
  itemId: string;
  itemName: string;
  type: TxType;
  qty: number;
  date: string;
  note: string;
  operator: string;
  createdAt: string;
}

export type Page = "dashboard" | "stok" | "transaksi";

/** online = tersambung; pending = ada perubahan lokal belum terkirim; offline = memakai cache lokal. */
export type SyncStatus = "loading" | "online" | "pending" | "offline";

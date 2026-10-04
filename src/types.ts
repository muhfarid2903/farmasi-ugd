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
  /** Transaksi terakhir yang mengubah stok; dipakai aturan keamanan untuk memverifikasi perubahan stok. */
  lastTxId?: string;
  /** Tanggal kedaluwarsa terdekat, "YYYY-MM". Kosong jika tidak diketahui atau stok habis. */
  expiry?: string;
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
  /** Email akun yang mencatat (kosong untuk transaksi sebelum ada login). */
  email?: string;
  /** ED barang yang diterima ("YYYY-MM"), hanya pada barang masuk dan bila diisi. */
  expiry?: string;
  createdAt: string;
  /** Diisi pada transaksi pembatalan: id transaksi yang dibatalkan. */
  voidsTxId?: string;
  /** Diisi pada transaksi yang sudah dibatalkan: id transaksi pembatalannya. */
  voidedBy?: string;
}

export type Role = "admin" | "petugas";

/** Dokumen di koleksi `users`, dengan id = email (huruf kecil). */
export interface UserProfile {
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

export type Page = "beranda" | "stok" | "riwayat" | "bantuan" | "pengaturan";

/** online = tersambung; pending = ada perubahan lokal belum terkirim; offline = memakai cache lokal. */
export type SyncStatus = "loading" | "online" | "pending" | "offline";

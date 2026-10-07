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
  /** Diisi bila barang ini sudah digabung ke barang lain (id tujuannya). Barang ini lalu disembunyikan. */
  mergedInto?: string;
  mergedAt?: string;
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
  /** Penyesuaian stok (bukan barang masuk/keluar sungguhan): hasil stok opname atau koreksi admin. */
  adjust?: "opname" | "koreksi";
  /** Untuk penyesuaian opname: id dokumen opname-nya. */
  opnameId?: string;
}

/** Satu baris hasil hitung fisik dalam stok opname. */
export interface OpnameEntry {
  itemId: string;
  itemName: string;
  unit: string;
  /** Stok di aplikasi saat disimpan. */
  system: number;
  /** Hasil hitung fisik. */
  counted: number;
}

/** Dokumen di koleksi `opname`. */
export interface Opname {
  id: string;
  date: string;
  operator: string;
  email: string;
  note: string;
  entries: OpnameEntry[];
  createdAt: string;
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

export type Page =
  "beranda" | "stok" | "riwayat" | "bantuan" | "pengaturan" | "opname" | "darurat" | "kosongkan" | "gabung";

/** online = tersambung; pending = ada perubahan lokal belum terkirim; offline = memakai cache lokal. */
export type SyncStatus = "loading" | "online" | "pending" | "offline";

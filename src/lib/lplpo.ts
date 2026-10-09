import { CATEGORIES, type Item, type Transaction } from "../types";
import { monthLabel, monthName, shiftMonth } from "./date";
import { formatExpiry, monthsUntil, SOON_MONTHS } from "./expiry";
import { parseCount } from "./opname";
import { monthlyRecap } from "./recap";

/**
 * LPLPO (Laporan Pemakaian dan Lembar Permintaan Obat) dari UGD ke farmasi puskesmas,
 * mengikuti form kertas Dinkes Pangkep. Nomor kolom di bawah sama dengan nomor kolom di form.
 */

/** Kepala form. Nama dan NIP penanda tangan tidak ditulis di sini (kode ini publik), tetapi disimpan admin. */
export const LPLPO_KEPALA = {
  kodePuskesmas: "7309300",
  unit: "UGD",
  kabupaten: "PANGKAJENE DAN KEPULAUAN",
  provinsi: "SULAWESI SELATAN",
} as const;

export interface LplpoRow {
  itemId: string;
  name: string;
  unit: string;
  category: string;
  minStock: number;
  /** 4. Stok awal, sudah termasuk selisih hitung fisik/koreksi bulan itu. */
  stokAwal: number;
  /** 5. Penerimaan */
  penerimaan: number;
  /** 6 = 4 + 5 */
  persediaan: number;
  /** 7. Pemakaian */
  pemakaian: number;
  /** 8 = 6 − 7, sama dengan stok akhir bulan di aplikasi. */
  sisa: number;
  /** Selisih bersih hitung fisik/koreksi bulan itu, untuk kolom Ket. */
  selisih: number;
  /** Usulan untuk kolom 9 (permintaan). */
  usulan: number;
  /** 16. Keterangan otomatis. */
  ket: string;
}

/**
 * Usulan permintaan = stok optimum − sisa stok, dengan stok optimum = pemakaian sebulan + stok minimum
 * (cadangan selama menunggu kiriman). Tidak pernah kurang dari 0.
 */
export function usulanPermintaan(pemakaian: number, minStock: number, sisa: number): number {
  return Math.max(0, pemakaian + minStock - sisa);
}

/** Ket otomatis: selisih hitung fisik/koreksi, dan ED bila sudah/segera kedaluwarsa. */
export function ketOtomatis(selisih: number, item: Item | undefined, today: string): string {
  const parts: string[] = [];
  if (selisih) parts.push(`Selisih ${selisih > 0 ? "+" : "−"}${Math.abs(selisih)}`);
  if (item?.expiry && item.stock > 0 && monthsUntil(item.expiry, today) <= SOON_MONTHS) {
    parts.push(`ED ${formatExpiry(item.expiry)}`);
  }
  return parts.join("; ");
}

const CATEGORY_ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c, i]));

/**
 * Semua baris LPLPO untuk satu bulan pemakaian ("YYYY-MM"), urut per jenis lalu nama.
 *
 * Form kertas tidak punya kolom penyesuaian. Selisih hitung fisik/koreksi (stok opname) dihitung ke Stok Awal
 * dan dicatat di Ket, supaya Penerimaan dan Pemakaian hanya berisi barang yang benar-benar diterima dan dipakai.
 * Bila selisih kurang lebih besar dari stok awal (barang yang baru diterima bulan itu ternyata kurang),
 * kelebihannya dihitung sebagai pemakaian supaya stok awal tidak minus.
 * Hitungan selalu seimbang: 6 = 4 + 5, dan 8 = 6 − 7 = stok akhir bulan di aplikasi.
 */
export function lplpoRows(allItems: Item[], transactions: Transaction[], month: string, today: string): LplpoRow[] {
  const byId = new Map(allItems.map((i) => [i.id, i]));
  return monthlyRecap(allItems, transactions, month)
    .map((r): LplpoRow => {
      const item = byId.get(r.itemId);
      const awal = r.start + r.adjust;
      const stokAwal = Math.max(0, awal);
      const pemakaian = r.keluar + Math.max(0, -awal);
      const persediaan = stokAwal + r.masuk;
      const sisa = persediaan - pemakaian;
      const minStock = item?.minStock ?? 0;
      return {
        itemId: r.itemId,
        name: r.itemName,
        unit: r.unit,
        category: r.category,
        minStock,
        stokAwal,
        penerimaan: r.masuk,
        persediaan,
        pemakaian,
        sisa,
        selisih: r.adjust,
        usulan: usulanPermintaan(pemakaian, minStock, sisa),
        ket: ketOtomatis(r.adjust, item, today),
      };
    })
    .sort(
      (a, b) =>
        (CATEGORY_ORDER.get(a.category) ?? CATEGORIES.length) - (CATEGORY_ORDER.get(b.category) ?? CATEGORIES.length) ||
        a.name.localeCompare(b.name, "id", { numeric: true }),
    );
}

/** Angka permintaan: isian petugas bila ada (dikosongkan = 0), selain itu usulan. null = isian tidak valid. */
export function permintaanValue(row: Pick<LplpoRow, "usulan">, raw: string | undefined): number | null {
  if (raw === undefined) return row.usulan;
  if (raw.trim() === "") return 0;
  return parseCount(raw);
}

/** Baris yang dicetak: punya stok, pergerakan, atau selisih bulan itu; diusulkan diminta; atau ditambahkan petugas. */
export function isPrinted(row: LplpoRow, added: ReadonlySet<string>): boolean {
  return (
    added.has(row.itemId) ||
    row.stokAwal !== 0 ||
    row.penerimaan !== 0 ||
    row.pemakaian !== 0 ||
    row.sisa !== 0 ||
    row.selisih !== 0 ||
    row.usulan > 0
  );
}

/**
 * Isian "Bulan pelaporan", "Bulan pemakaian", dan "Tahun" di kepala form.
 * Pelaporan = bulan sesudah bulan pemakaian. Bila tahunnya berbeda (Desember → Januari), tahun ikut ditulis.
 */
export function lplpoPeriode(month: string): { pelaporan: string; pemakaian: string; tahun: string } {
  const lapor = shiftMonth(month, 1);
  const sameYear = lapor.slice(0, 4) === month.slice(0, 4);
  const name = (m: string) => (sameYear ? monthName(m) : monthLabel(m));
  return { pelaporan: name(lapor), pemakaian: name(month), tahun: month.slice(0, 4) };
}

export interface Signer {
  /** Mis. "Mengetahui," atau "Yang Menyerahkan," */
  role: string;
  /** Jabatan, mis. "Kepala Puskesmas Liukang Tupabbiring" */
  title: string;
  name: string;
  nip: string;
}

export const SIGNER_SLOTS = 3;

/** Penanda tangan untuk alur UGD → farmasi puskesmas. Nama & NIP diisi admin di aplikasi. */
export const DEFAULT_SIGNERS: Signer[] = [
  { role: "Mengetahui,", title: "Kepala Puskesmas Liukang Tupabbiring", name: "", nip: "" },
  { role: "Yang Menyerahkan,", title: "Petugas Farmasi Puskesmas", name: "", nip: "" },
  { role: "Yang Meminta/Melapor,", title: "Penanggung Jawab UGD", name: "", nip: "" },
];

/** Penanda tangan yang dicetak: isian yang seluruhnya kosong dilewati. */
export function printedSigners(signers: Signer[]): Signer[] {
  return signers.filter((s) => [s.role, s.title, s.name, s.nip].some((v) => v.trim() !== ""));
}

/** Jumlah kunjungan; kosong bila umum dan BPJS sama-sama kosong. */
export function totalKunjungan(umum: number | null, bpjs: number | null): number | null {
  return umum === null && bpjs === null ? null : (umum ?? 0) + (bpjs ?? 0);
}

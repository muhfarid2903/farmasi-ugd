import type { Item } from "../types";

/** ED disimpan sebagai "YYYY-MM" (bulan & tahun, seperti tertera di kemasan). */
export const EXPIRY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Batas "segera kedaluwarsa", dalam bulan. */
export const SOON_MONTHS = 3;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2027-03" → "Mar 2027" */
export function formatExpiry(expiry: string): string {
  const [y, m] = expiry.split("-");
  return `${BULAN_PENDEK[Number(m) - 1] ?? m} ${y}`;
}

/** Selisih bulan dari bulan ini ke bulan ED (0 = bulan ini, negatif = sudah lewat). */
export function monthsUntil(expiry: string, today: string): number {
  const [ey, em] = expiry.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  return (ey - ty) * 12 + (em - tm);
}

export type ExpiryStatus = "lewat" | "segera" | "aman";

/**
 * Obat dengan ED bulan tertentu masih boleh dipakai sampai akhir bulan itu.
 * Lewat = bulan ED sudah lewat; segera = dalam SOON_MONTHS bulan ke depan (termasuk bulan ini).
 */
export function expiryStatus(expiry: string, today: string): ExpiryStatus {
  const n = monthsUntil(expiry, today);
  if (n < 0) return "lewat";
  return n <= SOON_MONTHS ? "segera" : "aman";
}

/** Kalimat singkat untuk sisa waktu, mis. "bulan ini", "2 bulan lagi", "sudah lewat". */
export function expiryText(expiry: string, today: string): string {
  const n = monthsUntil(expiry, today);
  if (n < 0) return "sudah lewat";
  if (n === 0) return "habis bulan ini";
  return `${n} bulan lagi`;
}

/** Barang yang masih ada stoknya dan sudah/segera kedaluwarsa, urut dari yang paling dulu. */
export function expiringItems(items: Item[], today: string): Item[] {
  return items
    .filter((i) => i.stock > 0 && i.expiry && expiryStatus(i.expiry, today) !== "aman")
    .sort((a, b) => a.expiry!.localeCompare(b.expiry!));
}

/**
 * ED barang setelah barang masuk dengan ED tertentu.
 * Jika stok lama masih ada, simpan ED yang lebih cepat (lebih aman); jika stok kosong, pakai ED baru.
 * Mengembalikan undefined jika tidak ada perubahan.
 */
export function expiryAfterIncoming(item: Pick<Item, "stock" | "expiry">, incoming: string): string | undefined {
  const next = item.stock > 0 && item.expiry && item.expiry < incoming ? item.expiry : incoming;
  return next === item.expiry ? undefined : next;
}

/**
 * Perubahan ED barang yang menyertai sebuah transaksi:
 * - barang masuk dengan ED → ED terdekat diperbarui (lihat expiryAfterIncoming);
 * - barang keluar sampai stok habis → ED dikosongkan (null);
 * - selain itu → undefined (ED tidak berubah).
 */
export function expiryPatch(
  item: Pick<Item, "stock" | "expiry">,
  tx: { type: "masuk" | "keluar"; qty: number; expiry?: string },
): string | null | undefined {
  if (tx.type === "masuk") return tx.expiry ? expiryAfterIncoming(item, tx.expiry) : undefined;
  return item.expiry && item.stock - tx.qty <= 0 ? null : undefined;
}

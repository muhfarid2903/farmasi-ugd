import type { Item, OpnameEntry } from "../types";

/**
 * Baris opname dari hasil hitung (itemId → jumlah fisik), memakai stok aplikasi saat ini.
 * Item yang belum dihitung dilewati. Urut: selisih terbesar dulu, lalu nama.
 */
export function opnameEntries(counts: Record<string, number>, items: Item[]): OpnameEntry[] {
  return items
    .filter((i) => counts[i.id] !== undefined)
    .map((i) => ({ itemId: i.id, itemName: i.name, unit: i.unit, system: i.stock, counted: counts[i.id] }))
    .sort(
      (a, b) => Math.abs(b.counted - b.system) - Math.abs(a.counted - a.system) || a.itemName.localeCompare(b.itemName),
    );
}

/** Selisih hitung fisik terhadap aplikasi: positif = lebih banyak dari catatan. */
export function opnameDiff(e: Pick<OpnameEntry, "system" | "counted">): number {
  return e.counted - e.system;
}

/** Kalimat selisih, mis. "pas", "lebih 2 ampul", "kurang 3 ampul". */
export function diffText(e: Pick<OpnameEntry, "system" | "counted" | "unit">): string {
  const d = opnameDiff(e);
  if (d === 0) return "pas";
  return `${d > 0 ? "lebih" : "kurang"} ${Math.abs(d)} ${e.unit}`;
}

/** Validasi isian hitung fisik; mengembalikan angka, atau null jika kosong/tidak valid. */
export function parseCount(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

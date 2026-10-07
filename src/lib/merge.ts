import { normalize } from "./search";
import type { Item, Transaction } from "../types";

/** Penanda sumber dana di nama barang, mis. "(DAK)", "( DAU)", "(Dak)", atau "JKN" di akhir nama. */
const FUNDING = "dak|dau|jkn|pkg|dbhcht|dhcht|apbd|blud";
const FUNDING_PAREN = new RegExp(`\\(\\s*(${FUNDING})\\s*\\)`, "gi");
const FUNDING_TAIL = new RegExp(`\\s+(${FUNDING})\\s*$`, "i");

/** Nama barang tanpa penanda sumber dana. */
export function stripFunding(name: string): string {
  return name.replace(FUNDING_PAREN, " ").replace(FUNDING_TAIL, "").replace(/\s+/g, " ").trim();
}

/** Kunci pembanding: barang dengan kunci sama dianggap barang yang sama (beda sumber dana/penulisan saja). */
export function sameItemKey(name: string): string {
  return normalize(stripFunding(name));
}

/** Barang yang belum digabung ke barang lain (yang tampil di aplikasi). */
export function activeItems(items: Item[]): Item[] {
  return items.some((i) => i.mergedInto) ? items.filter((i) => !i.mergedInto) : items;
}

/** id barang yang sudah digabung → id barang tujuannya (mengikuti gabungan berantai). */
export function mergeAliases(items: Item[]): Map<string, string> {
  const into = new Map(items.filter((i) => i.mergedInto).map((i) => [i.id, i.mergedInto!]));
  const aliases = new Map<string, string>();
  for (const id of into.keys()) {
    let target = id;
    const seen = new Set<string>();
    while (into.has(target) && !seen.has(target)) {
      seen.add(target);
      target = into.get(target)!;
    }
    aliases.set(id, target);
  }
  return aliases;
}

/**
 * Transaksi dengan itemId diarahkan ke barang hasil gabungan, supaya riwayat salinan lama
 * ikut terhitung pada barang tujuannya (rekap, barang yang sering dipakai).
 * Hanya untuk perhitungan; transaksi aslinya di database tidak berubah.
 */
export function withMergedIds(transactions: Transaction[], items: Item[]): Transaction[] {
  const aliases = mergeAliases(items);
  if (aliases.size === 0) return transactions;
  return transactions.map((t) => {
    const target = aliases.get(t.itemId);
    return target ? { ...t, itemId: target } : t;
  });
}

export interface MergeGroup {
  key: string;
  /** Urutan: barang yang dipertahankan lebih dulu. */
  items: Item[];
  /** Satuan berbeda: stok tidak bisa langsung dijumlahkan. */
  unitsDiffer: boolean;
}

/** Barang yang dipertahankan: obat darurat lebih dulu, lalu yang stoknya paling banyak, lalu yang paling lama dibuat. */
function keepOrder(a: Item, b: Item): number {
  return (
    Number(!!b.kritis) - Number(!!a.kritis) ||
    b.stock - a.stock ||
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
    a.id.localeCompare(b.id)
  );
}

export function mergeGroup(items: Item[]): MergeGroup {
  const sorted = [...items].sort(keepOrder);
  return {
    key: sameItemKey(sorted[0].name),
    items: sorted,
    unitsDiffer: new Set(items.map((i) => i.unit.trim().toLowerCase())).size > 1,
  };
}

/** Kelompok barang aktif yang namanya sama (mengabaikan sumber dana, huruf besar/kecil, dan tanda baca). */
export function findDuplicateGroups(items: Item[]): MergeGroup[] {
  const byKey = new Map<string, Item[]>();
  for (const i of activeItems(items)) {
    const k = sameItemKey(i.name);
    byKey.set(k, [...(byKey.get(k) ?? []), i]);
  }
  return [...byKey.values()]
    .filter((g) => g.length > 1)
    .map(mergeGroup)
    .sort((a, b) => a.items[0].name.localeCompare(b.items[0].name));
}

/** Usulan nama hasil gabungan: nama yang sama dipakai apa adanya; jika berbeda, tanpa penanda sumber dana. */
export function suggestedName(group: MergeGroup): string {
  const names = new Set(group.items.map((i) => normalize(i.name)));
  const keep = group.items[0].name.trim();
  return names.size === 1 ? keep : stripFunding(keep);
}

/** Perubahan pada barang yang dipertahankan. */
export interface MergeUpdate {
  name: string;
  kritis: boolean;
  minStock: number;
  /** ED terdekat dari salinan yang masih ada stoknya; undefined = tidak berubah. */
  expiry?: string;
  /** Stok setelah digabung. */
  stock: number;
}

export function mergeUpdate(group: MergeGroup, name: string): MergeUpdate {
  const [keep] = group.items;
  const expiries = group.items
    .filter((i) => i.stock > 0 && i.expiry)
    .map((i) => i.expiry!)
    .sort();
  return {
    name: name.trim(),
    kritis: group.items.some((i) => i.kritis),
    // Batas minimum yang terbesar: lebih aman untuk UGD
    minStock: Math.max(...group.items.map((i) => i.minStock || 0)),
    expiry: expiries[0] !== keep.expiry ? expiries[0] : undefined,
    stock: group.items.reduce((s, i) => s + i.stock, 0),
  };
}

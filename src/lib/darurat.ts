import type { DaruratUsulan } from "../data/darurat-usulan";
import type { Item } from "../types";

export interface DaruratDiff {
  /** Akan ditandai darurat. */
  add: (Item & { basis: string })[];
  /** Akan dilepas dari daftar darurat. */
  remove: Item[];
  /** Sudah darurat dan tetap. */
  keep: (Item & { basis: string })[];
  /** Nama dalam usulan yang tidak ada di daftar barang. */
  notFound: string[];
  /** Perbaikan satuan yang masih perlu. */
  unitFixes: { item: Item; unit: string; reason: string }[];
}

/** Bandingkan tanda darurat saat ini dengan usulan (dicocokkan berdasarkan nama persis). */
export function daruratDiff(
  items: Item[],
  usulan: DaruratUsulan[],
  fixes: { name: string; unit: string; reason: string }[] = [],
): DaruratDiff {
  const basisOf = new Map(usulan.map((u) => [u.name, u.basis]));
  const names = new Set(items.map((i) => i.name));
  const diff: DaruratDiff = { add: [], remove: [], keep: [], notFound: [], unitFixes: [] };
  for (const item of items) {
    const basis = basisOf.get(item.name);
    if (basis && item.kritis) diff.keep.push({ ...item, basis });
    else if (basis) diff.add.push({ ...item, basis });
    else if (item.kritis) diff.remove.push(item);
  }
  diff.notFound = usulan.filter((u) => !names.has(u.name)).map((u) => u.name);
  for (const f of fixes) {
    const item = items.find((i) => i.name === f.name);
    if (item && item.unit !== f.unit) diff.unitFixes.push({ item, unit: f.unit, reason: f.reason });
  }
  return diff;
}

export function hasChanges(d: DaruratDiff): boolean {
  return d.add.length + d.remove.length + d.unitFixes.length > 0;
}

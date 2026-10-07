import type { DaruratUsulan } from "../data/darurat-usulan";
import { sameItemKey, stripFunding } from "./merge";
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

/**
 * Bandingkan tanda darurat saat ini dengan usulan. Nama dicocokkan tanpa melihat sumber dana,
 * huruf besar/kecil, dan tanda baca, supaya barang yang sudah digabung (mis. "Ringer Laktat Larutan"
 * dari "(DAK)" dan "(DAU)") tetap dikenali.
 */
export function daruratDiff(
  items: Item[],
  usulan: DaruratUsulan[],
  fixes: { name: string; unit: string; reason: string }[] = [],
): DaruratDiff {
  const basisOf = new Map(usulan.map((u) => [sameItemKey(u.name), u.basis]));
  const keys = new Set(items.map((i) => sameItemKey(i.name)));
  const diff: DaruratDiff = { add: [], remove: [], keep: [], notFound: [], unitFixes: [] };
  for (const item of items) {
    const basis = basisOf.get(sameItemKey(item.name));
    if (basis && item.kritis) diff.keep.push({ ...item, basis });
    else if (basis) diff.add.push({ ...item, basis });
    else if (item.kritis) diff.remove.push(item);
  }
  diff.notFound = [...new Set(usulan.filter((u) => !keys.has(sameItemKey(u.name))).map((u) => stripFunding(u.name)))];
  for (const f of fixes) {
    const key = sameItemKey(f.name);
    for (const item of items.filter((i) => sameItemKey(i.name) === key)) {
      if (item.unit !== f.unit) diff.unitFixes.push({ item, unit: f.unit, reason: f.reason });
    }
  }
  return diff;
}

export function hasChanges(d: DaruratDiff): boolean {
  return d.add.length + d.remove.length + d.unitFixes.length > 0;
}

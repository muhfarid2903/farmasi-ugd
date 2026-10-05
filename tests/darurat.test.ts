import { describe, expect, it } from "vitest";
import { DARURAT_USULAN, DATA_FIXES } from "../src/data/darurat-usulan";
import { daruratDiff, hasChanges } from "../src/lib/darurat";
import type { Item } from "../src/types";

const item = (name: string, kritis: boolean, unit = "ampul") =>
  ({ id: name, name, kritis, unit, stock: 0, minStock: 0, category: "Obat" }) as Item;

describe("daruratDiff", () => {
  const usulan = [
    { name: "Epinefrin", basis: "KMK 4799/2021" as const },
    { name: "Glukosa 40%", basis: "KMK 4799/2021" as const },
    { name: "Tidak Ada", basis: "PMK 47/2018" as const },
  ];
  const items = [item("Epinefrin", true), item("Glukosa 40%", false), item("Abacavir", true), item("Kasa", false)];

  it("memisahkan tambah, lepas, tetap, dan nama yang tidak ditemukan", () => {
    const d = daruratDiff(items, usulan);
    expect(d.add.map((i) => i.name)).toEqual(["Glukosa 40%"]);
    expect(d.remove.map((i) => i.name)).toEqual(["Abacavir"]);
    expect(d.keep.map((i) => [i.name, i.basis])).toEqual([["Epinefrin", "KMK 4799/2021"]]);
    expect(d.notFound).toEqual(["Tidak Ada"]);
    expect(hasChanges(d)).toBe(true);
  });
  it("perbaikan satuan hanya bila masih berbeda", () => {
    const fixes = [{ name: "Kasa", unit: "box", reason: "x" }];
    expect(daruratDiff(items, usulan, fixes).unitFixes).toHaveLength(1);
    expect(daruratDiff([item("Kasa", false, "box")], [], fixes).unitFixes).toHaveLength(0);
  });
  it("setelah diterapkan, tidak ada perubahan lagi", () => {
    const applied = items.map((i) => ({ ...i, kritis: usulan.some((u) => u.name === i.name) }));
    expect(hasChanges(daruratDiff(applied, usulan))).toBe(false);
  });
});

describe("DARURAT_USULAN", () => {
  it("tidak ada nama ganda dan semua punya dasar", () => {
    const names = DARURAT_USULAN.map((u) => u.name);
    expect(new Set(names).size).toBe(names.length);
    expect(DARURAT_USULAN.every((u) => u.basis)).toBe(true);
  });
  it("memuat seluruh 18 obat KMK 4799/2021 yang tersedia di daftar barang", () => {
    expect(DARURAT_USULAN.filter((u) => u.basis === "KMK 4799/2021").length).toBeGreaterThanOrEqual(18);
    expect(DATA_FIXES.length).toBeGreaterThan(0);
  });
});

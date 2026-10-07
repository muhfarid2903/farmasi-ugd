import { describe, expect, it } from "vitest";
import { daruratDiff } from "../src/lib/darurat";
import {
  activeItems,
  findDuplicateGroups,
  mergeAliases,
  mergeUpdate,
  sameItemKey,
  stripFunding,
  suggestedName,
  withMergedIds,
} from "../src/lib/merge";
import { monthlyRecap } from "../src/lib/recap";
import type { Item, Transaction } from "../src/types";

const item = (id: string, name: string, stock: number, extra: Partial<Item> = {}): Item =>
  ({ id, name, category: "Obat", unit: "botol", stock, minStock: 0, kritis: false, ...extra }) as Item;
const tx = (id: string, itemId: string, type: "masuk" | "keluar", qty: number, date: string) =>
  ({ id, itemId, itemName: itemId, type, qty, date }) as Transaction;

describe("stripFunding / sameItemKey", () => {
  it("menghapus penanda sumber dana dalam berbagai penulisan", () => {
    expect(stripFunding("Ringer Laktat Larutan (DAK)")).toBe("Ringer Laktat Larutan");
    expect(stripFunding("Infusion Set Anak ( DAU)")).toBe("Infusion Set Anak");
    expect(stripFunding("Alat suntik sekali pakai 5 ml( DAK )")).toBe("Alat suntik sekali pakai 5 ml");
    expect(stripFunding("Blood Lancet (Dak)")).toBe("Blood Lancet");
    expect(stripFunding("Multivitamin Sirup (Caviplex) JKN")).toBe("Multivitamin Sirup (Caviplex)");
    expect(stripFunding("Silk 3/0 (DHCHT)")).toBe("Silk 3/0");
  });
  it("tidak menghapus keterangan lain dalam kurung", () => {
    expect(stripFunding("Deksametason inj 5 mg/ml (i.v./i.m.)")).toBe("Deksametason inj 5 mg/ml (i.v./i.m.)");
    expect(stripFunding("Fitomenadion (vitamin K1) inj 10 mg/ml")).toBe("Fitomenadion (vitamin K1) inj 10 mg/ml");
  });
  it("beda sumber dana, huruf besar/kecil, dan spasi dianggap sama; beda kekuatan tidak", () => {
    expect(sameItemKey("Ringer Laktat Larutan (DAK)")).toBe(sameItemKey("ringer laktat  larutan (DAU)"));
    expect(sameItemKey("Infusion Set Anak ( DAU)")).toBe(sameItemKey("Infusion set anak"));
    expect(sameItemKey("Diazepam enema 5 mg/2,5 ml")).not.toBe(sameItemKey("Diazepam enema 10 mg/2,5 ml"));
  });
});

describe("findDuplicateGroups", () => {
  const items = [
    item("a", "Ringer Laktat Larutan (DAK)", 104, { kritis: true, minStock: 20 }),
    item("b", "Ringer Laktat Larutan (DAU)", 6, { minStock: 30 }),
    item("c", "Ringer Laktat Larutan (DAK)", 0),
    item("d", "Asering", 44),
    item("e", "Blood Lancet (Dak)", 0, { unit: "box" }),
    item("f", "Blood Lancet (PKG)", 0, { unit: "buah" }),
    item("g", "Kasa", 3),
    item("h", "Asering", 1, { mergedInto: "d" }),
  ];
  const groups = findDuplicateGroups(items);

  it("mengelompokkan barang yang sama dan mengabaikan yang sudah digabung", () => {
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      ["e", "f"],
      ["a", "b", "c"],
    ]);
  });
  it("menandai kelompok yang satuannya berbeda", () => {
    expect(groups.map((g) => g.unitsDiffer)).toEqual([true, false]);
  });
  it("hasil gabungan: stok dijumlah, darurat & minimum yang paling aman, nama tanpa sumber dana", () => {
    const rl = groups[1];
    expect(suggestedName(rl)).toBe("Ringer Laktat Larutan");
    expect(mergeUpdate(rl, suggestedName(rl))).toEqual({
      name: "Ringer Laktat Larutan",
      kritis: true,
      minStock: 30,
      expiry: undefined,
      stock: 110,
    });
  });
  it("nama yang persis sama dipakai apa adanya", () => {
    const [g] = findDuplicateGroups([item("x", "KETOROLAC INJ (JKN)", 4), item("y", "Ketorolac inj (JKN)", 0)]);
    expect(suggestedName(g)).toBe("KETOROLAC INJ (JKN)");
  });
  it("ED terdekat diambil dari salinan yang masih ada stoknya", () => {
    const [g] = findDuplicateGroups([
      item("x", "NaCl (DAK)", 5, { expiry: "2027-06" }),
      item("y", "NaCl", 2, { expiry: "2026-12" }),
      item("z", "NaCl (DAU)", 0, { expiry: "2026-01" }),
    ]);
    expect(mergeUpdate(g, "NaCl").expiry).toBe("2026-12");
  });
});

describe("barang yang sudah digabung", () => {
  const items = [
    item("a", "Asering", 45),
    item("b", "Asering (DAU)", 0, { mergedInto: "a" }),
    item("c", "Asering (JKN)", 0, { mergedInto: "b" }),
  ];
  it("disembunyikan dan diarahkan ke barang tujuan (juga berantai)", () => {
    expect(activeItems(items).map((i) => i.id)).toEqual(["a"]);
    expect(mergeAliases(items)).toEqual(
      new Map([
        ["b", "a"],
        ["c", "a"],
      ]),
    );
    expect(withMergedIds([tx("t1", "c", "keluar", 1, "2026-09-01")], items)[0].itemId).toBe("a");
  });
  it("rekap bulanan menghitung riwayat salinan lama pada barang tujuan, dan tetap seimbang", () => {
    // September: a +40, b +6 & −1. Oktober: penyatuan (koreksi b −5, a +5).
    const txs = [
      tx("t1", "a", "masuk", 40, "2026-09-02"),
      tx("t2", "b", "masuk", 6, "2026-09-03"),
      tx("t3", "b", "keluar", 1, "2026-09-10"),
      { ...tx("t4", "b", "keluar", 5, "2026-10-07"), adjust: "koreksi" as const },
      { ...tx("t5", "a", "masuk", 5, "2026-10-07"), adjust: "koreksi" as const },
    ];
    const sep = monthlyRecap(items, txs, "2026-09");
    expect(sep).toHaveLength(1);
    expect(sep[0]).toMatchObject({ itemName: "Asering", start: 0, masuk: 46, keluar: 1, end: 45 });
    const okt = monthlyRecap(items, txs, "2026-10");
    expect(okt[0]).toMatchObject({ start: 45, adjust: 0, end: 45 });
  });
});

describe("daftar obat darurat setelah digabung", () => {
  it("nama tanpa sumber dana tetap dikenali sebagai obat darurat", () => {
    const usulan = [
      { name: "Ringer Laktat Larutan (DAK)", basis: "PMK 47/2018" as const },
      { name: "Ringer Laktat Larutan (DAU)", basis: "PMK 47/2018" as const },
    ];
    const d = daruratDiff([item("a", "Ringer Laktat Larutan", 0, { kritis: true })], usulan);
    expect(d.keep.map((i) => i.id)).toEqual(["a"]);
    expect(d.remove).toEqual([]);
    expect(d.notFound).toEqual([]);
  });
});

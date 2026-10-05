import { describe, expect, it } from "vitest";
import { diffText, opnameEntries, parseCount } from "../src/lib/opname";
import { activeRows, monthlyRecap } from "../src/lib/recap";
import type { Item, Transaction } from "../src/types";

const item = (id: string, stock: number): Item =>
  ({ id, name: `Item ${id}`, category: "Obat", unit: "ampul", stock, minStock: 0, kritis: false }) as Item;
let n = 0;
const tx = (itemId: string, type: "masuk" | "keluar", qty: number, date: string, extra: Partial<Transaction> = {}) =>
  ({ id: extra.id ?? `t${++n}`, itemId, itemName: `Item ${itemId}`, type, qty, date, ...extra }) as Transaction;

describe("monthlyRecap", () => {
  it("menghitung stok awal & akhir mundur dari stok sekarang", () => {
    // Stok sekarang 12. Oktober: +10, −3. November: −5.
    const txs = [
      tx("a", "masuk", 10, "2026-10-02"),
      tx("a", "keluar", 3, "2026-10-20"),
      tx("a", "keluar", 5, "2026-11-01"),
    ];
    const [r] = monthlyRecap([item("a", 12)], txs, "2026-10");
    expect(r).toMatchObject({ start: 10, masuk: 10, keluar: 3, adjust: 0, end: 17 });
    const [nov] = monthlyRecap([item("a", 12)], txs, "2026-11");
    expect(nov).toMatchObject({ start: 17, keluar: 5, end: 12 });
  });
  it("transaksi yang dibatalkan di bulan yang sama tidak dihitung sebagai masuk/keluar", () => {
    const txs = [
      tx("a", "masuk", 4, "2026-10-02", { id: "x", voidedBy: "y" }),
      tx("a", "keluar", 4, "2026-10-02", { id: "y", voidsTxId: "x" }),
      tx("a", "keluar", 1, "2026-10-03"),
    ];
    const [r] = monthlyRecap([item("a", 5)], txs, "2026-10");
    expect(r).toMatchObject({ start: 6, masuk: 0, keluar: 1, end: 5 });
  });
  it("pembatalan di bulan berikutnya tetap tercatat di masing-masing bulan", () => {
    const txs = [
      tx("a", "masuk", 4, "2026-10-30", { id: "x", voidedBy: "y" }),
      tx("a", "keluar", 4, "2026-11-02", { id: "y", voidsTxId: "x" }),
    ];
    expect(monthlyRecap([item("a", 0)], txs, "2026-10")[0]).toMatchObject({ start: 0, masuk: 4, end: 4 });
    expect(monthlyRecap([item("a", 0)], txs, "2026-11")[0]).toMatchObject({ start: 4, keluar: 4, end: 0 });
  });
  it("penyesuaian opname/koreksi masuk kolom tersendiri", () => {
    const txs = [
      tx("a", "keluar", 2, "2026-10-10", { adjust: "opname" }),
      tx("a", "masuk", 1, "2026-10-11", { adjust: "koreksi" }),
    ];
    expect(monthlyRecap([item("a", 9)], txs, "2026-10")[0]).toMatchObject({
      start: 10,
      masuk: 0,
      keluar: 0,
      adjust: -1,
      end: 9,
    });
  });
  it("barang yang sudah dihapus tetap muncul bila punya transaksi", () => {
    const rows = monthlyRecap([], [tx("z", "keluar", 2, "2026-10-01")], "2026-10");
    expect(rows[0]).toMatchObject({ itemName: "Item z (sudah dihapus)", keluar: 2 });
  });
  it("activeRows membuang barang tanpa stok & tanpa pergerakan", () => {
    expect(activeRows(monthlyRecap([item("a", 0), item("b", 3)], [], "2026-10")).map((r) => r.itemId)).toEqual(["b"]);
  });
});

describe("monthlyRecap selalu seimbang", () => {
  it("stok awal + masuk − keluar + penyesuaian = stok akhir, untuk campuran transaksi", () => {
    const txs = [
      tx("a", "masuk", 10, "2026-09-28"),
      tx("a", "keluar", 2, "2026-10-01"),
      tx("a", "masuk", 4, "2026-10-02", { id: "p", voidedBy: "q" }),
      tx("a", "keluar", 4, "2026-10-03", { id: "q", voidsTxId: "p" }),
      tx("a", "keluar", 1, "2026-10-29", { id: "r", voidedBy: "s" }),
      tx("a", "masuk", 1, "2026-11-01", { id: "s", voidsTxId: "r" }),
      tx("a", "keluar", 3, "2026-10-15", { adjust: "opname" }),
      tx("b", "masuk", 6, "2026-10-05"),
      tx("b", "keluar", 2, "2026-12-01"),
    ];
    for (const month of ["2026-09", "2026-10", "2026-11", "2026-12"]) {
      for (const r of monthlyRecap([item("a", 4), item("b", 4)], txs, month)) {
        expect(r.start + r.masuk - r.keluar + r.adjust, `${r.itemId} ${month}`).toBe(r.end);
      }
    }
  });
});

describe("opname", () => {
  const items = [item("a", 5), item("b", 2), item("c", 9)];
  it("hanya barang yang dihitung, selisih terbesar dulu", () => {
    const e = opnameEntries({ a: 5, c: 4 }, items);
    expect(e.map((x) => [x.itemId, x.system, x.counted])).toEqual([
      ["c", 9, 4],
      ["a", 5, 5],
    ]);
  });
  it("kalimat selisih", () => {
    expect(diffText({ system: 5, counted: 5, unit: "ampul" })).toBe("pas");
    expect(diffText({ system: 5, counted: 7, unit: "ampul" })).toBe("lebih 2 ampul");
    expect(diffText({ system: 5, counted: 2, unit: "ampul" })).toBe("kurang 3 ampul");
  });
  it("parseCount menerima bilangan bulat ≥ 0", () => {
    expect(parseCount("0")).toBe(0);
    expect(parseCount(" 12 ")).toBe(12);
    expect(parseCount("")).toBeNull();
    expect(parseCount("-1")).toBeNull();
    expect(parseCount("1.5")).toBeNull();
  });
});

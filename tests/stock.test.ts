import { describe, expect, it } from "vitest";
import {
  filterByPeriod,
  isLowStock,
  stockChanges,
  validateItemForm,
  validateStockChanges,
  validateTxForm,
  type ItemForm,
  type TxForm,
} from "../src/lib/stock";
import type { Item, Transaction } from "../src/types";

const item = (id: string, stock: number, extra: Partial<Item> = {}): Item => ({
  id,
  name: `Item ${id}`,
  category: "Obat",
  unit: "ampul",
  stock,
  minStock: 3,
  kritis: false,
  ...extra,
});

describe("isLowStock", () => {
  it("menandai stok di bawah atau sama dengan minimum", () => {
    expect(isLowStock({ stock: 3, minStock: 3 })).toBe(true);
    expect(isLowStock({ stock: 1, minStock: 3 })).toBe(true);
    expect(isLowStock({ stock: 4, minStock: 3 })).toBe(false);
  });
  it("mengabaikan item dengan minimum stok 0", () => {
    expect(isLowStock({ stock: 0, minStock: 0 })).toBe(false);
  });
});

describe("stockChanges", () => {
  it("transaksi baru: masuk menambah, keluar mengurangi", () => {
    expect(stockChanges({ itemId: "a", type: "masuk", qty: 5 })).toEqual(new Map([["a", 5]]));
    expect(stockChanges({ itemId: "a", type: "keluar", qty: 2 })).toEqual(new Map([["a", -2]]));
  });
  it("edit jumlah pada item yang sama hanya menerapkan selisihnya", () => {
    const prev = { itemId: "a", type: "masuk" as const, qty: 10 };
    expect(stockChanges({ itemId: "a", type: "masuk", qty: 7 }, prev)).toEqual(new Map([["a", -3]]));
  });
  it("edit tipe masuk → keluar membalik dua kali lipat", () => {
    const prev = { itemId: "a", type: "masuk" as const, qty: 4 };
    expect(stockChanges({ itemId: "a", type: "keluar", qty: 4 }, prev)).toEqual(new Map([["a", -8]]));
  });
  it("edit ganti item: item lama dibalik, item baru diterapkan", () => {
    const prev = { itemId: "a", type: "keluar" as const, qty: 2 };
    expect(stockChanges({ itemId: "b", type: "keluar", qty: 2 }, prev)).toEqual(
      new Map([
        ["a", 2],
        ["b", -2],
      ]),
    );
  });
  it("edit tanpa perubahan tidak menghasilkan perubahan stok", () => {
    const prev = { itemId: "a", type: "keluar" as const, qty: 2 };
    expect(stockChanges(prev, prev).size).toBe(0);
  });
});

describe("validateStockChanges", () => {
  const items = [item("a", 5), item("b", 1)];
  it("menolak barang keluar melebihi stok", () => {
    expect(validateStockChanges(new Map([["a", -6]]), items)).toBe("Stok tidak cukup! Tersedia: 5 ampul");
  });
  it("mengizinkan stok tepat habis", () => {
    expect(validateStockChanges(new Map([["a", -5]]), items)).toBeNull();
  });
  it("menolak edit yang membuat stok item lama negatif", () => {
    const msg = validateStockChanges(
      new Map([
        ["b", -3],
        ["a", 3],
      ]),
      items,
    );
    expect(msg).toContain("Item b menjadi negatif (-2)");
  });
  it("menolak item yang tidak ada", () => {
    expect(validateStockChanges(new Map([["x", 1]]), items)).toBe("Item tidak ditemukan di database");
  });
});

describe("validateTxForm", () => {
  const base: TxForm = { itemId: "a", type: "keluar", qty: "2", date: "2026-10-05", note: "", operator: "Ani" };
  it("menerima isian valid", () => expect(validateTxForm(base)).toBeNull());
  it("menolak jumlah nol, negatif, atau desimal", () => {
    for (const qty of ["0", "-5", "1.5"]) expect(validateTxForm({ ...base, qty })).not.toBeNull();
  });
  it("menolak petugas kosong atau hanya spasi", () => {
    expect(validateTxForm({ ...base, operator: "  " })).not.toBeNull();
  });
  it("menolak tanggal kosong", () => {
    expect(validateTxForm({ ...base, date: "" })).toBe("Tanggal wajib diisi");
  });
});

describe("validateItemForm", () => {
  const base: ItemForm = {
    name: "Epinefrin",
    category: "Obat",
    unit: "ampul",
    stock: "0",
    minStock: "0",
    kritis: true,
  };
  it("stok 0 dan minimum 0 valid", () => expect(validateItemForm(base)).toBeNull());
  it("menolak kolom kosong", () => {
    expect(validateItemForm({ ...base, stock: "" })).toBe("Semua field wajib diisi");
    expect(validateItemForm({ ...base, name: " " })).toBe("Semua field wajib diisi");
  });
  it("menolak angka negatif atau desimal", () => {
    expect(validateItemForm({ ...base, stock: "-1" })).not.toBeNull();
    expect(validateItemForm({ ...base, minStock: "2.5" })).not.toBeNull();
  });
});

describe("filterByPeriod", () => {
  const tx = (date: string) => ({ id: date, date }) as Transaction;
  const txs = [tx("2026-09-30"), tx("2026-10-01"), tx("2026-10-31"), tx("2026-11-01")];
  it("per bulan", () => {
    expect(filterByPeriod(txs, { mode: "bulan", month: "2026-10" }).map((t) => t.date)).toEqual([
      "2026-10-01",
      "2026-10-31",
    ]);
  });
  it("rentang tanggal inklusif", () => {
    expect(filterByPeriod(txs, { mode: "rentang", from: "2026-09-30", to: "2026-10-01" })).toHaveLength(2);
  });
});

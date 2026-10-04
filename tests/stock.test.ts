import { describe, expect, it } from "vitest";
import {
  canVoid,
  filterByPeriod,
  isLowStock,
  stockChanges,
  validateItemForm,
  validateStockChanges,
  validateTxForm,
  voidTxData,
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
  it("masuk menambah, keluar mengurangi", () => {
    expect(stockChanges({ itemId: "a", type: "masuk", qty: 5 })).toEqual(new Map([["a", 5]]));
    expect(stockChanges({ itemId: "a", type: "keluar", qty: 2 })).toEqual(new Map([["a", -2]]));
  });
});

describe("validateStockChanges", () => {
  const items = [item("a", 5)];
  it("menolak barang keluar melebihi stok", () => {
    expect(validateStockChanges(new Map([["a", -6]]), items)).toBe(
      "Stok Item a tinggal 5 ampul, tidak cukup untuk 6 ampul. Periksa lagi jumlahnya.",
    );
  });
  it("mengizinkan stok tepat habis", () => {
    expect(validateStockChanges(new Map([["a", -5]]), items)).toBeNull();
  });
  it("menolak item yang tidak ada", () => {
    expect(validateStockChanges(new Map([["x", 1]]), items)).toBe(
      "Barang ini tidak ditemukan. Mungkin sudah dihapus admin.",
    );
  });
});

describe("pembatalan transaksi", () => {
  const tx: Transaction = {
    id: "t1",
    itemId: "a",
    itemName: "Epinefrin",
    type: "masuk",
    qty: 10,
    date: "2026-10-01",
    note: "Dari farmasi",
    operator: "Ani",
    email: "ani@gmail.com",
    createdAt: "2026-10-01T01:00:00Z",
  };
  const admin = { email: "admin@gmail.com", role: "admin" };
  const ani = { email: "ani@gmail.com", role: "petugas" };
  const budi = { email: "budi@gmail.com", role: "petugas" };

  it("voidTxData membalik tipe dengan item & jumlah sama", () => {
    expect(voidTxData(tx, { name: "Budi", email: "budi@gmail.com" }, "2026-10-05", " salah jumlah ")).toEqual({
      itemId: "a",
      itemName: "Epinefrin",
      type: "keluar",
      qty: 10,
      date: "2026-10-05",
      note: "Pembatalan transaksi 2026-10-01 — salah jumlah",
      operator: "Budi",
      email: "budi@gmail.com",
      voidsTxId: "t1",
    });
  });
  it("pembuat dan admin boleh membatalkan, petugas lain tidak", () => {
    expect(canVoid(tx, ani)).toBe(true);
    expect(canVoid(tx, admin)).toBe(true);
    expect(canVoid(tx, budi)).toBe(false);
  });
  it("transaksi lama tanpa email hanya bisa dibatalkan admin", () => {
    const old = { ...tx, email: undefined };
    expect(canVoid(old, admin)).toBe(true);
    expect(canVoid(old, ani)).toBe(false);
  });
  it("transaksi yang sudah dibatalkan atau transaksi pembatalan tidak bisa dibatalkan lagi", () => {
    expect(canVoid({ ...tx, voidedBy: "t2" }, admin)).toBe(false);
    expect(canVoid({ ...tx, voidsTxId: "t0" }, admin)).toBe(false);
  });
});

describe("validateTxForm", () => {
  const base: TxForm = { itemId: "a", type: "keluar", qty: "2", date: "2026-10-05", note: "" };
  it("menerima isian valid", () => expect(validateTxForm(base)).toBeNull());
  it("menolak jumlah nol, negatif, atau desimal", () => {
    for (const qty of ["0", "-5", "1.5"]) expect(validateTxForm({ ...base, qty })).not.toBeNull();
  });
  it("menolak item kosong", () => {
    expect(validateTxForm({ ...base, itemId: "" })).toBe("Pilih dulu barangnya.");
  });
  it("menolak tanggal kosong", () => {
    expect(validateTxForm({ ...base, date: "" })).toBe("Tanggal belum diisi.");
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

import { describe, expect, it } from "vitest";
import { defaultHitungUlangDate, hitungUlangCandidates, hitungUlangPlan } from "../src/lib/hitungUlang";
import { lplpoRows } from "../src/lib/lplpo";
import type { Item, Transaction } from "../src/types";

const item = (id: string, stock: number, extra: Partial<Item> = {}): Item =>
  ({ id, name: `Item ${id}`, category: "Obat", unit: "ampul", stock, minStock: 0, kritis: false, ...extra }) as Item;
let n = 0;
const tx = (itemId: string, type: "masuk" | "keluar", qty: number, date: string, extra: Partial<Transaction> = {}) =>
  ({
    id: extra.id ?? `t${++n}`,
    itemId,
    itemName: `Item ${itemId}`,
    type,
    qty,
    date,
    createdAt: `${date}T03:00:0${n % 10}.000Z`,
    ...extra,
  }) as Transaction;

describe("hitungUlangCandidates", () => {
  it("hanya barang masuk sungguhan pada tanggal itu yang belum dibatalkan, dan barangnya masih aktif", () => {
    const items = [item("a", 5), item("b", 3)];
    const txs = [
      tx("a", "masuk", 5, "2026-10-14", { id: "ok" }),
      tx("a", "keluar", 1, "2026-10-14"),
      tx("a", "masuk", 2, "2026-10-13"),
      tx("a", "masuk", 4, "2026-10-14", { adjust: "opname" }),
      tx("b", "masuk", 3, "2026-10-14", { id: "batal", voidedBy: "x" }),
      tx("b", "keluar", 3, "2026-10-14", { id: "x", voidsTxId: "batal" }),
      tx("hilang", "masuk", 9, "2026-10-14"),
    ];
    expect(hitungUlangCandidates(txs, items, "2026-10-14").map((t) => t.id)).toEqual(["ok"]);
  });

  it("tanggal awal: tanggal terakhir bulan ini yang punya catatan masuk, selain itu hari ini", () => {
    const items = [item("a", 5)];
    const txs = [tx("a", "masuk", 5, "2026-10-14"), tx("a", "masuk", 1, "2026-09-30")];
    expect(defaultHitungUlangDate(txs, items, "2026-10-16")).toBe("2026-10-14");
    expect(defaultHitungUlangDate([], items, "2026-10-16")).toBe("2026-10-16");
    expect(defaultHitungUlangDate(txs.slice(1), items, "2026-10-16")).toBe("2026-10-16");
  });
});

describe("hitungUlangPlan", () => {
  it("dua catatan untuk barang yang sama dibatalkan di putaran berbeda; hitung fisik dijumlahkan per barang", () => {
    const items = [item("iv24", 7), item("rl", 11)];
    const txs = [
      tx("iv24", "masuk", 4, "2026-10-14"),
      tx("iv24", "masuk", 3, "2026-10-14"),
      tx("rl", "masuk", 11, "2026-10-14"),
    ];
    const plan = hitungUlangPlan(txs, items);
    expect(plan.voidRounds.map((r) => r.map((t) => `${t.itemId}:${t.qty}`))).toEqual([["iv24:4", "rl:11"], ["iv24:3"]]);
    expect(plan.entries).toEqual([
      { itemId: "iv24", itemName: "Item iv24", unit: "ampul", system: 0, counted: 7 },
      { itemId: "rl", itemName: "Item rl", unit: "ampul", system: 0, counted: 11 },
    ]);
  });
});

describe("LPLPO sesudah dijadikan hitung fisik", () => {
  it("penerimaan palsu hilang, stok akhir tetap, angkanya pindah ke stok awal sebagai selisih", () => {
    // 1 Okt stok 6 → dikosongkan (opname −6) → hitung ulang dicatat sebagai masuk 17 → stok 17
    const items = [item("inf", 17)];
    const kosong = tx("inf", "keluar", 6, "2026-10-05", { adjust: "opname" });
    const masuk = tx("inf", "masuk", 17, "2026-10-14", { id: "m" });
    const before = lplpoRows(items, [kosong, masuk], "2026-10", "2026-10-14")[0];
    expect(before).toMatchObject({ stokAwal: 0, penerimaan: 17, sisa: 17, selisih: -6 });

    // Sesudah alat: masuk dibatalkan, lalu +17 sebagai opname; stok barang tetap 17
    const plan = hitungUlangPlan([masuk], items);
    const [e] = plan.entries;
    const after = [
      kosong,
      { ...masuk, voidedBy: "v" },
      tx("inf", "keluar", 17, "2026-10-14", { id: "v", voidsTxId: "m" }),
      tx("inf", "masuk", e.counted - e.system, "2026-10-14", { adjust: "opname" }),
    ];
    const row = lplpoRows(items, after, "2026-10", "2026-10-14")[0];
    expect(row).toMatchObject({ stokAwal: 17, penerimaan: 0, pemakaian: 0, sisa: 17, selisih: 11 });
    expect(row.ket).toBe("Selisih +11");
  });
});

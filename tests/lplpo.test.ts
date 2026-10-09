import { describe, expect, it } from "vitest";
import {
  isPrinted,
  ketOtomatis,
  lplpoPeriode,
  lplpoRows,
  permintaanValue,
  printedSigners,
  totalKunjungan,
  usulanPermintaan,
} from "../src/lib/lplpo";
import { monthlyRecap } from "../src/lib/recap";
import type { Category, Item, Transaction } from "../src/types";

const TODAY = "2026-10-10";
const item = (id: string, stock: number, extra: Partial<Item> = {}): Item =>
  ({ id, name: `Item ${id}`, category: "Obat", unit: "botol", stock, minStock: 0, kritis: false, ...extra }) as Item;
let n = 0;
const tx = (itemId: string, type: "masuk" | "keluar", qty: number, date: string, extra: Partial<Transaction> = {}) =>
  ({ id: extra.id ?? `t${++n}`, itemId, itemName: `Item ${itemId}`, type, qty, date, ...extra }) as Transaction;

describe("lplpoRows", () => {
  it("mengisi kolom 4–8 dari catatan masuk/keluar (contoh form: 2 + 20 = 22, dipakai 12, sisa 10)", () => {
    const txs = [tx("rl", "masuk", 20, "2026-10-03"), tx("rl", "keluar", 12, "2026-10-20")];
    const [r] = lplpoRows([item("rl", 10, { minStock: 10 })], txs, "2026-10", TODAY);
    expect(r).toMatchObject({ stokAwal: 2, penerimaan: 20, persediaan: 22, pemakaian: 12, sisa: 10, selisih: 0 });
    // Usulan = pemakaian 12 + minimum 10 − sisa 10
    expect(r.usulan).toBe(12);
    expect(r.ket).toBe("");
  });

  it("selisih hitung fisik dihitung ke stok awal, bukan ke penerimaan/pemakaian, dan dicatat di Ket", () => {
    const txs = [tx("a", "keluar", 3, "2026-10-01", { adjust: "opname" }), tx("a", "keluar", 2, "2026-10-05")];
    const [r] = lplpoRows([item("a", 9)], txs, "2026-10", TODAY);
    expect(r).toMatchObject({ stokAwal: 11, penerimaan: 0, persediaan: 11, pemakaian: 2, sisa: 9, selisih: -3 });
    expect(r.ket).toBe("Selisih −3");
  });

  it("stok dikosongkan lalu dihitung ulang dalam sebulan: tidak muncul pemakaian palsu", () => {
    const txs = [
      tx("a", "keluar", 50, "2026-10-06", { adjust: "opname" }),
      tx("a", "masuk", 12, "2026-10-07", { adjust: "opname" }),
      tx("a", "keluar", 3, "2026-10-15"),
    ];
    const [r] = lplpoRows([item("a", 9)], txs, "2026-10", TODAY);
    expect(r).toMatchObject({ stokAwal: 12, penerimaan: 0, pemakaian: 3, sisa: 9, selisih: -38 });
  });

  it("selisih kurang yang lebih besar dari stok awal dihitung sebagai pemakaian, stok awal tidak minus", () => {
    // Awal 0, diterima 10, opname ternyata 7 (kurang 3), dipakai 2 → sisa 5
    const txs = [
      tx("a", "masuk", 10, "2026-10-01"),
      tx("a", "keluar", 3, "2026-10-02", { adjust: "opname" }),
      tx("a", "keluar", 2, "2026-10-03"),
    ];
    const [r] = lplpoRows([item("a", 5)], txs, "2026-10", TODAY);
    expect(r).toMatchObject({ stokAwal: 0, penerimaan: 10, persediaan: 10, pemakaian: 5, sisa: 5, selisih: -3 });
  });

  it("selalu seimbang dan sama dengan rekap: 6 = 4 + 5, 8 = 6 − 7 = stok akhir", () => {
    const txs = [
      tx("a", "masuk", 10, "2026-09-28"),
      tx("a", "keluar", 2, "2026-10-01"),
      tx("a", "masuk", 4, "2026-10-02", { id: "p", voidedBy: "q" }),
      tx("a", "keluar", 4, "2026-10-03", { id: "q", voidsTxId: "p" }),
      tx("a", "keluar", 3, "2026-10-15", { adjust: "opname" }),
      tx("a", "masuk", 6, "2026-11-02", { adjust: "koreksi" }),
      tx("b", "masuk", 6, "2026-10-05"),
      tx("b", "keluar", 9, "2026-10-06", { adjust: "opname" }),
      tx("b", "keluar", 2, "2026-12-01"),
    ];
    const items = [item("a", 11), item("b", 4)];
    for (const month of ["2026-09", "2026-10", "2026-11", "2026-12"]) {
      const recap = new Map(monthlyRecap(items, txs, month).map((r) => [r.itemId, r]));
      for (const r of lplpoRows(items, txs, month, TODAY)) {
        const label = `${r.itemId} ${month}`;
        expect(r.persediaan, label).toBe(r.stokAwal + r.penerimaan);
        expect(r.sisa, label).toBe(r.persediaan - r.pemakaian);
        expect(r.sisa, label).toBe(recap.get(r.itemId)!.end);
        expect(r.stokAwal, label).toBeGreaterThanOrEqual(0);
        expect(r.pemakaian, label).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("barang yang sudah digabung tidak muncul sendiri; pemindahan stok gabungan bukan selisih", () => {
    const items = [item("a", 5), item("b", 0, { mergedInto: "a" })];
    const txs = [
      tx("b", "masuk", 3, "2026-10-01"),
      tx("b", "keluar", 3, "2026-10-05", { adjust: "koreksi" }),
      tx("a", "masuk", 3, "2026-10-05", { adjust: "koreksi" }),
      tx("a", "masuk", 2, "2026-10-06"),
    ];
    const rows = lplpoRows(items, txs, "2026-10", TODAY);
    expect(rows.map((r) => r.itemId)).toEqual(["a"]);
    expect(rows[0]).toMatchObject({ stokAwal: 0, penerimaan: 5, pemakaian: 0, sisa: 5, selisih: 0, ket: "" });
  });

  it("barang yang sudah dihapus hanya ikut bila bulan itu ada barang masuk/keluar sungguhan", () => {
    // x dan y sudah dihapus. Oktober: stok keduanya dikosongkan (opname) sebelum dihapus.
    const txs = [
      tx("x", "keluar", 15, "2026-10-06", { adjust: "opname" }),
      tx("y", "keluar", 2, "2026-09-10"),
      tx("y", "keluar", 3, "2026-10-06", { adjust: "opname" }),
    ];
    const sept = lplpoRows([], txs, "2026-09", TODAY);
    // x hanya punya sisa angka lama (15) tanpa pergerakan September → tidak dicetak
    expect(sept.map((r) => r.itemId)).toEqual(["y"]);
    expect(sept[0]).toMatchObject({ name: "Item y (sudah dihapus)", stokAwal: 5, pemakaian: 2, sisa: 3 });
    // Oktober hanya ada pengosongan (penyesuaian), bukan pemakaian → keduanya tidak dicetak
    expect(lplpoRows([], txs, "2026-10", TODAY)).toEqual([]);
  });

  it("urut per jenis (Obat, Alat Medis, Cairan Infus, ...) lalu nama, angka urut sebagai angka", () => {
    const mk = (id: string, name: string, category: Category) => item(id, 1, { name, category });
    const rows = lplpoRows(
      [
        mk("1", "Spuit 3 cc", "Alat Medis"),
        mk("2", "Ringer Laktat", "Cairan Infus"),
        mk("3", "Ondansetron inj", "Obat"),
        mk("4", "Adrenalin inj", "Obat"),
        mk("5", "Abocath 22", "Alat Medis"),
        mk("6", "NGT No. 16", "Alat Medis"),
        mk("7", "NGT No. 8", "Alat Medis"),
      ],
      [],
      "2026-10",
      TODAY,
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Adrenalin inj",
      "Ondansetron inj",
      "Abocath 22",
      "NGT No. 8",
      "NGT No. 16",
      "Spuit 3 cc",
      "Ringer Laktat",
    ]);
  });
});

describe("usulanPermintaan", () => {
  it("pemakaian + stok minimum − sisa, tidak kurang dari 0", () => {
    expect(usulanPermintaan(12, 10, 10)).toBe(12);
    expect(usulanPermintaan(0, 4, 0)).toBe(4);
    expect(usulanPermintaan(3, 5, 20)).toBe(0);
    expect(usulanPermintaan(0, 0, 5)).toBe(0);
  });
});

describe("ketOtomatis", () => {
  it("mencatat selisih dan ED yang sudah/segera lewat (≤ 3 bulan) bila barangnya masih ada", () => {
    expect(ketOtomatis(2, item("a", 4, { expiry: "2026-12" }), TODAY)).toBe("Selisih +2; ED Des 2026");
    expect(ketOtomatis(0, item("a", 4, { expiry: "2026-08" }), TODAY)).toBe("ED Agu 2026");
    expect(ketOtomatis(0, item("a", 4, { expiry: "2027-06" }), TODAY)).toBe("");
    expect(ketOtomatis(0, item("a", 0, { expiry: "2026-11" }), TODAY)).toBe("");
    expect(ketOtomatis(-1, undefined, TODAY)).toBe("Selisih −1");
  });
});

describe("isPrinted", () => {
  const rows = lplpoRows(
    [item("kosong", 0), item("ada", 3), item("diminta", 0, { minStock: 4 })],
    [],
    "2026-10",
    TODAY,
  );
  const byId = new Map(rows.map((r) => [r.itemId, r]));
  it("mencetak barang yang punya stok atau diusulkan diminta", () => {
    expect(isPrinted(byId.get("ada")!, new Set())).toBe(true);
    expect(isPrinted(byId.get("diminta")!, new Set())).toBe(true);
    expect(byId.get("diminta")!.usulan).toBe(4);
  });
  it("barang tanpa stok & pergerakan hanya dicetak bila ditambahkan", () => {
    expect(isPrinted(byId.get("kosong")!, new Set())).toBe(false);
    expect(isPrinted(byId.get("kosong")!, new Set(["kosong"]))).toBe(true);
  });
});

describe("permintaanValue", () => {
  it("memakai usulan bila belum diubah; kosong = 0; isian tidak valid = null", () => {
    expect(permintaanValue({ usulan: 12 }, undefined)).toBe(12);
    expect(permintaanValue({ usulan: 12 }, "")).toBe(0);
    expect(permintaanValue({ usulan: 12 }, " 7 ")).toBe(7);
    expect(permintaanValue({ usulan: 12 }, "-1")).toBeNull();
    expect(permintaanValue({ usulan: 12 }, "2.5")).toBeNull();
  });
});

describe("lplpoPeriode", () => {
  it("bulan pelaporan = bulan sesudah bulan pemakaian", () => {
    expect(lplpoPeriode("2026-10")).toEqual({ pelaporan: "November", pemakaian: "Oktober", tahun: "2026" });
  });
  it("menulis tahun bila melewati pergantian tahun", () => {
    expect(lplpoPeriode("2026-12")).toEqual({
      pelaporan: "Januari 2027",
      pemakaian: "Desember 2026",
      tahun: "2026",
    });
  });
});

describe("printedSigners & totalKunjungan", () => {
  it("melewati penanda tangan yang seluruhnya kosong", () => {
    const signers = [
      { role: "Mengetahui,", title: "Kepala Puskesmas", name: "", nip: "" },
      { role: " ", title: "", name: "", nip: "" },
      { role: "", title: "", name: "Ani", nip: "" },
    ];
    expect(printedSigners(signers).map((s) => s.role || s.name)).toEqual(["Mengetahui,", "Ani"]);
  });
  it("total kunjungan kosong bila umum & BPJS kosong", () => {
    expect(totalKunjungan(null, null)).toBeNull();
    expect(totalKunjungan(5, null)).toBe(5);
    expect(totalKunjungan(5, 7)).toBe(12);
  });
});

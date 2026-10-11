import { describe, expect, it } from "vitest";
import type { RecapRow } from "../src/lib/recap";
import { normalize } from "../src/lib/search";
import {
  answerEntries,
  buildPlan,
  cellsToWrite,
  checkPaste,
  findMonthTab,
  isTableHeader,
  matchLine,
  monthLines,
  pasteText,
  readOpnameTab,
  similarRows,
  stockLines,
  tabPeriod,
  type OpnameRow,
  type OpnameTab,
  type StockLine,
} from "../src/lib/stokOpname";
import { readXlsx, type CellValue } from "../src/lib/xlsx";
import type { Item, Transaction } from "../src/types";
import { contohXlsx } from "./fixtures/contoh";

/** Tab buatan: daftar [nama, satuan, isi UGD] mulai baris 10. */
function tabOf(rows: [string, string, CellValue?][], firstRow = 10): OpnameTab {
  const seen = new Map<string, number>();
  const out: OpnameRow[] = rows.map(([name, unit, ugd = null], i) => {
    const key = `${normalize(name)}|${normalize(unit)}`;
    const ke = (seen.get(key) ?? 0) + 1;
    seen.set(key, ke);
    return { row: firstRow + i, name, unit, ugd, ke };
  });
  return {
    name: "Uji",
    ugdCol: 12,
    rows: out,
    firstRow,
    lastRow: firstRow + rows.length - 1,
    column: out.map((r) => r.ugd),
    warnings: [],
  };
}

const line = (name: string, stock: number, extra: Partial<StockLine> = {}): StockLine => ({
  key: normalize(name),
  itemIds: [`id-${name}`],
  name,
  unit: "",
  stock,
  deleted: false,
  mixedUnits: false,
  count: 1,
  ...extra,
});

const recap = (itemId: string, itemName: string, unit: string, end: number): RecapRow => ({
  itemId,
  itemName,
  category: "Obat",
  unit,
  start: end,
  masuk: 0,
  keluar: 0,
  adjust: 0,
  end,
});

describe("tab bulan", () => {
  it("membaca bulan dan tahun dari nama tab yang tidak seragam", () => {
    expect(tabPeriod("oktober 2026")).toEqual({ month: 10, year: 2026 });
    expect(tabPeriod("OKTOBER 2025")).toEqual({ month: 10, year: 2025 });
    expect(tabPeriod("NOP 2026")).toEqual({ month: 11, year: 2026 });
    expect(tabPeriod("DES 2026")).toEqual({ month: 12, year: 2026 });
    expect(tabPeriod("MEI")).toEqual({ month: 5, year: null });
    expect(tabPeriod("September")).toEqual({ month: 9, year: null });
    expect(tabPeriod("Sheet1")).toEqual({ month: null, year: null });
  });

  it("menemukan tab bulan; tab tanpa tahun memakai tahun di kepala laporan", async () => {
    const wb = await readXlsx(contohXlsx());
    expect(await findMonthTab(wb, "2026-09")).toEqual({ name: "SEPTEMBER 2026" });
    // Tab "MEI" kepalanya salah tulis "APRIL 2026", tapi tahunnya tetap terbaca
    expect(await findMonthTab(wb, "2026-05")).toEqual({ name: "MEI" });
    expect(await findMonthTab(wb, "2026-11")).toEqual({ name: "NOP 2026" });
    expect(await findMonthTab(wb, "2026-10")).toMatchObject({ candidates: [] });
    expect(await findMonthTab(wb, "2025-05")).toMatchObject({ candidates: [] });
  });
});

describe("readOpnameTab", () => {
  it("mencari kolom lewat judulnya dan membaca baris barang beserta peringatan", async () => {
    const tab = readOpnameTab(await (await readXlsx(contohXlsx())).sheet("SEPTEMBER 2026"));
    if ("error" in tab) throw new Error(tab.error);
    expect(tab.ugdCol).toBe(6);
    expect(tab.firstRow).toBe(10);
    expect(tab.lastRow).toBe(22);
    expect(tab.rows).toHaveLength(12);
    // Baris kosong di tengah tetap ikut di kolom tempel supaya urutannya tidak bergeser
    expect(tab.column).toHaveLength(13);
    expect(tab.column[18 - 10]).toBeNull();
    expect(tab.rows.filter((r) => r.name === "Alkohol swab").map((r) => r.ke)).toEqual([1, 2]);
    expect(tab.rows.find((r) => r.row === 12)?.ugd).toBe(3);
    const warnings = tab.warnings.join("\n");
    expect(warnings).toContain('tabel Excel ("Tabel1", D11:E15) tepat di sebelah kolom UGD');
    expect(warnings).toContain("F11");
    expect(warnings).toContain("1 baris yang disembunyikan (baris 19)");
    expect(warnings).toContain("rumus di baris 13");
    expect(warnings).toContain("desimal di baris 21");
  });

  it("melapor bila judul NAMA OBAT atau UGD tidak ada", async () => {
    const wb = await readXlsx(contohXlsx());
    expect(readOpnameTab(await wb.sheet("Sheet1"))).toEqual({ error: expect.stringContaining("NAMA OBAT") });
  });
});

describe("stockLines", () => {
  it("menjumlah barang bernama sama, menandai satuan berbeda dan barang yang sudah dihapus", () => {
    const lines = stockLines(
      [
        recap("a1", "Asering", "botol", 44),
        recap("a2", "Asering", "botol", 1),
        recap("p1", "Parasetamol Infus (JKN)", "botol", 9),
        recap("p2", "Parasetamol Infus (JKN)", "bag", 4),
        recap("x1", "Alat suntik 1 (sudah dihapus)", "", 15),
      ],
      new Set(["a1", "a2", "p1", "p2"]),
    );
    expect(lines.find((l) => l.name === "Asering")).toMatchObject({ stock: 45, count: 2, mixedUnits: false });
    expect(lines.find((l) => l.name === "Parasetamol Infus (JKN)")).toMatchObject({
      stock: 13,
      mixedUnits: true,
      unit: "9 botol + 4 bag",
    });
    expect(lines.find((l) => l.name === "Alat suntik 1")).toMatchObject({ deleted: true, stock: 15 });
  });

  it("monthLines: stok akhir bulan dari catatan aplikasi, sama dengan rekap", () => {
    const items = [{ id: "rl", name: "Ringer Laktat", unit: "botol", category: "Cairan Infus", stock: 7 }] as Item[];
    const txs = [
      { id: "t1", itemId: "rl", itemName: "Ringer Laktat", type: "keluar", qty: 3, date: "2026-10-05" },
      { id: "t2", itemId: "hapus", itemName: "Kasa", type: "masuk", qty: 2, date: "2026-09-02" },
    ] as Transaction[];
    const lines = monthLines(items, txs, "2026-09");
    // Akhir September = 7 sekarang + 3 yang dipakai Oktober
    expect(lines.find((l) => l.name === "Ringer Laktat")?.stock).toBe(10);
    expect(lines.find((l) => l.name === "Kasa")).toMatchObject({ deleted: true });
  });
});

describe("matchLine", () => {
  const tab = tabOf([
    ["Air untuk injeksi", "Botol 100 ml"],
    ["Air untuk injeksi", "Botol 250 ml"],
    ["Epinefrin (adrenalin) inj 1 mg/ml", "Ampul"],
    ["NaCl 0,9% Larutan", "Botol @500 ml"],
    ["NaCl 0,9% Larutan", "Botol @100 ml"],
    ["NaCl 0,9% Larutan (DAK)", "Botol"],
    ["Ringer Laktat Larutan (DAK)", "Botol"],
    ["Ringer Laktat Larutan (DAU)", "Botol"],
    ["RANITIN HCL INJ 50 MG/2 ML", "Ampul"],
    [" sekali pakai 3 ml", "Pcs"],
    ["Alkohol swab", "Kotak 100 pcs"],
    ["Alkohol swab", "Kotak 100 pcs"],
  ]).rows;
  const rowNo = (m: { rows: OpnameRow[] }) => m.rows.map((r) => r.row);

  it("nama persis (tanpa memperhatikan huruf besar/kecil dan tanda baca) langsung cocok", () => {
    expect(matchLine(line("epinefrin (adrenalin) inj 1 mg/ml", 5), tab, undefined)).toMatchObject({
      kind: "persis",
      rows: [{ row: 12 }],
    });
  });

  it("nama ganda: satuan yang sama persis menentukan barisnya, selain itu ditanyakan", () => {
    expect(rowNo(matchLine(line("Air untuk injeksi", 11, { unit: "Botol 250 ml" }), tab, undefined))).toEqual([11]);
    const m = matchLine(line("Air untuk injeksi", 11, { unit: "botol" }), tab, undefined);
    expect(m.kind).toBe("ganda");
    expect(rowNo(m)).toEqual([10, 11]);
    // Baris versi sumber dana ikut ditawarkan
    expect(rowNo(matchLine(line("NaCl 0,9% Larutan", 2, { unit: "botol" }), tab, undefined))).toEqual([13, 14, 15]);
  });

  it("dipisah per sumber dana di file: ditanyakan", () => {
    const m = matchLine(line("Ringer Laktat Larutan", 104), tab, undefined);
    expect(m.kind).toBe("sumber-dana");
    expect(rowNo(m)).toEqual([16, 17]);
  });

  it("salah ketik dan nama terpotong di file: ditawarkan sebagai calon teratas", () => {
    expect(matchLine(line("RANITIDIN HCL INJ 50 MG/2 ML", 8), tab, undefined)).toMatchObject({
      kind: "mirip",
      rows: [{ row: 18 }],
    });
    expect(similarRows("Alat suntik sekali pakai 3 ml", tab)[0].row).toBe(19);
    expect(matchLine(line("Benang jahit", 1), tab, undefined)).toEqual({ kind: "tidak-ada", rows: [] });
  });

  it("padanan tersimpan dipakai, termasuk satuan dan urutan baris kembar", () => {
    expect(rowNo(matchLine(line("RANITIDIN", 8), tab, { nama: ["RANITIN HCL INJ 50 MG/2 ML"] }))).toEqual([18]);
    expect(
      matchLine(line("Alkohol swab", 1), tab, { nama: ["Alkohol swab"], satuan: "kotak 100 pcs", ke: 2 }),
    ).toMatchObject({ kind: "padanan", rows: [{ row: 21 }] });
    expect(matchLine(line("Masker", 2), tab, { lewati: true }).kind).toBe("lewati");
  });

  it("padanan yang namanya sudah tidak ada: pakai nama persis bila ada, selain itu ditanyakan ulang", () => {
    expect(matchLine(line("Epinefrin (adrenalin) inj 1 mg/ml", 5), tab, { nama: ["Epi lama"] }).kind).toBe("persis");
    const m = matchLine(line("Ranitidin injeksi", 8), tab, { nama: ["RANITIDIN HCL INJ 50 MG/2 ML"] });
    expect(m.kind).toBe("berubah");
    expect(m.rows[0].row).toBe(18);
  });

  it("barang yang sudah dihapus tidak pernah diisi otomatis, kecuali sudah dijawab", () => {
    const hapus = line("Epinefrin (adrenalin) inj 1 mg/ml", 5, { deleted: true });
    expect(matchLine(hapus, tab, undefined)).toMatchObject({ kind: "dihapus", rows: [{ row: 12 }] });
    expect(matchLine(hapus, tab, { nama: ["Epinefrin (adrenalin) inj 1 mg/ml"] }).kind).toBe("padanan");
    expect(matchLine(hapus, tab, { lewati: true }).kind).toBe("lewati");
  });

  it("satuan berbeda di aplikasi: ditanyakan dulu, kecuali boleh dijumlahkan", () => {
    const campur = line("Epinefrin (adrenalin) inj 1 mg/ml", 13, { mixedUnits: true, unit: "9 botol + 4 bag" });
    expect(matchLine(campur, tab, undefined).kind).toBe("satuan-beda");
    expect(matchLine(campur, tab, { nama: ["Epinefrin (adrenalin) inj 1 mg/ml"], jumlahkan: true }).kind).toBe(
      "padanan",
    );
  });
});

describe("buildPlan", () => {
  const tab = tabOf([
    ["Asering", "Botol"],
    ["Epinefrin", "Ampul", 5],
    ["Diazepam", "Tube", 3],
    ["Silk 3/0", "Pcs", 4],
    ["Catgut", "Pcs"],
    ["Kasa", "Roll", "Kolom 3"],
    ["Ringer Laktat (DAK)", "Botol"],
    ["Ringer Laktat (DAU)", "Botol"],
  ]);

  it("sel kosong diisi; sel berisi angka lain ditanyakan; yang ragu ditanyakan", () => {
    const plan = buildPlan(
      [
        line("Asering", 44),
        line("Epinefrin", 5),
        line("Diazepam", 7),
        line("Silk 3/0", 0),
        line("Catgut", 0),
        line("Ringer Laktat", 104),
        line("Masker", 2),
        line("Benang lama", 0),
      ],
      tab,
      { "id-Masker": { lewati: true } },
    );
    expect(plan.cells.map((c) => [c.action, c.row.row, c.value])).toEqual([
      ["isi", 10, 44],
      ["ganti", 12, 7],
      ["kosongkan", 13, null],
    ]);
    expect(plan.alreadyOk).toBe(1);
    expect(plan.questions.map((q) => [q.line.name, q.kind])).toEqual([["Ringer Laktat", "sumber-dana"]]);
    expect(plan.skipped.map((l) => l.name)).toEqual(["Masker"]);
    expect(plan.zeroUnmatched).toBe(1);
    // Sel UGD yang berisi tapi barangnya tidak ada di aplikasi bulan itu
    expect(plan.leftovers.map((r) => r.row)).toEqual([15]);
    expect(cellsToWrite(plan, false).map((c) => c.row.row)).toEqual([10]);
    expect(cellsToWrite(plan, true).map((c) => c.row.row)).toEqual([10, 12, 13]);
  });

  it("dua barang aplikasi yang menunjuk baris yang sama dijumlahkan", () => {
    const plan = buildPlan([line("Asering", 44), line("Asering botol kecil", 1)], tab, {
      "id-Asering botol kecil": { nama: ["Asering"] },
    });
    expect(plan.cells).toHaveLength(1);
    expect(plan.cells[0]).toMatchObject({ action: "isi", value: 45 });
    expect(plan.cells[0].lines.map((l) => l.name)).toEqual(["Asering", "Asering botol kecil"]);
  });
});

describe("answerEntries", () => {
  const rows = tabOf([
    ["Air untuk injeksi", "Botol 100 ml"],
    ["Air untuk injeksi", "Botol 250 ml"],
    ["Alkohol swab", "Kotak"],
    ["Alkohol swab", "Kotak"],
    ["LATAMOL CAIRAN INHALASI 2,5 ML", "Ampul"],
  ]).rows;

  it("menyimpan satuan dan urutan hanya bila perlu, untuk semua barang di kelompok itu", () => {
    const l = line("DILATAMOL", 5, { itemIds: ["d1", "d2"] });
    expect(answerEntries(l, { row: rows[4] }, rows, undefined)).toEqual({
      d1: { nama: ["LATAMOL CAIRAN INHALASI 2,5 ML"], label: "DILATAMOL" },
      d2: { nama: ["LATAMOL CAIRAN INHALASI 2,5 ML"], label: "DILATAMOL" },
    });
    expect(answerEntries(line("Air", 11), { row: rows[1] }, rows, undefined)).toEqual({
      "id-Air": { nama: ["Air untuk injeksi"], satuan: "Botol 250 ml", label: "Air" },
    });
    expect(answerEntries(line("Swab", 1), { row: rows[3] }, rows, undefined)["id-Swab"]).toMatchObject({
      satuan: "Kotak",
      ke: 2,
    });
  });

  it("nama baru di depan, nama lama tetap disimpan; lewati dan jumlahkan", () => {
    const prev = { nama: ["DILATAMOL lama", "LATAMOL CAIRAN INHALASI 2,5 ML"] };
    expect(answerEntries(line("D", 5), { row: rows[4] }, rows, prev)["id-D"].nama).toEqual([
      "LATAMOL CAIRAN INHALASI 2,5 ML",
      "DILATAMOL lama",
    ]);
    expect(answerEntries(line("M", 2), { lewati: true }, rows, undefined)).toEqual({
      "id-M": { lewati: true, label: "M" },
    });
    expect(answerEntries(line("P", 13), { row: rows[4], jumlahkan: true }, rows, undefined)["id-P"].jumlahkan).toBe(
      true,
    );
  });
});

describe("kolom tempel dan pemeriksaan", () => {
  const original = tabOf([
    ["Asering", "Botol"],
    ["", ""],
    ["Kasa", "Roll", "Kolom 3"],
    ["Silk", "Pcs", 4],
  ]);
  // Baris tanpa nama tidak termasuk daftar barang, tapi tetap ada di kolom tempel
  original.rows = original.rows.filter((r) => r.name);
  const plan = buildPlan([line("Asering", 44), line("Silk", 9)], original, {});
  const written = cellsToWrite(plan, true);

  it("satu kolom utuh: sel yang tidak diubah tetap berisi nilai lamanya", () => {
    expect(pasteText(original, written)).toBe("44\n\nKolom 3\n9");
    expect(pasteText(original, [])).toBe("\n\nKolom 3\n4");
  });

  it("isi baris teks dibersihkan dari tab dan baris baru", () => {
    const t = tabOf([["A", "x", "satu\tdua\nTiga"]]);
    expect(pasteText(t, [])).toBe("satu dua Tiga");
  });

  it("semua sesuai, walau ada baris yang disisipkan setelah rencana dibuat", () => {
    const fresh = tabOf(
      [
        ["Baru disisipkan", "Pcs"],
        ["Asering", "Botol", 44],
        ["Kasa", "Roll", "Kolom 3"],
        ["Silk", "Pcs", "9"],
      ],
      9,
    );
    const result = checkPaste(original, written, fresh);
    expect(result).toMatchObject({ ok: 2, total: 2, diffs: [] });
    expect(result.texts.map((r) => r.row)).toEqual([11]);
  });

  it("melaporkan sel yang belum terisi, sel lain yang ikut berubah, dan baris yang hilang", () => {
    const fresh = tabOf([
      ["Asering", "Botol"],
      ["Kasa", "Roll", 44],
    ]);
    const result = checkPaste(original, written, fresh);
    expect(result.ok).toBe(0);
    expect(result.diffs).toEqual([
      { name: "Asering", row: 10, expected: 44, actual: null, planned: true },
      { name: "Kasa", row: 11, expected: "Kolom 3", actual: 44, planned: false },
      { name: "Silk", row: null, expected: 9, actual: null, planned: true },
    ]);
  });

  it('judul "Kolom N" dari tabel yang melebar bukan kesalahan tempel, tetapi tetap dilaporkan sebagai teks', () => {
    const awal = tabOf([
      ["Air untuk injeksi", "Botol"],
      ["Asering", "Botol"],
    ]);
    const tulis = cellsToWrite(buildPlan([line("Asering", 44)], awal, {}), false);
    const fresh = tabOf([
      ["Air untuk injeksi", "Botol", "Kolom 3"],
      ["Asering", "Botol", 44],
    ]);
    const result = checkPaste(awal, tulis, fresh);
    expect(result).toMatchObject({ ok: 1, total: 1, diffs: [] });
    expect(result.texts.map((r) => r.ugd)).toEqual(["Kolom 3"]);
    // Setelah judulnya ditempeli kosong, Google menamainya ulang menjadi "Kolom 1 2"
    fresh.rows[0].ugd = "Kolom 1 2";
    expect(checkPaste(awal, tulis, fresh).diffs).toEqual([]);
    expect(isTableHeader("Kolom 1 2")).toBe(true);
    expect(isTableHeader("Kolom")).toBe(false);
    expect(isTableHeader("10 kolom")).toBe(false);
  });
});

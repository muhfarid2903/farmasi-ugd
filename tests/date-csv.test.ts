import { describe, expect, it } from "vitest";
import { buildRecapCSV, csvCell } from "../src/lib/csv";
import { formatDate, monthLabel, todayStr } from "../src/lib/date";
import type { Transaction } from "../src/types";

describe("todayStr", () => {
  it("memakai tanggal lokal, bukan UTC", () => {
    // 02:00 waktu lokal tanggal 5 → tetap tanggal 5 walau di UTC masih tanggal 4
    expect(todayStr(new Date(2026, 9, 5, 2, 0))).toBe("2026-10-05");
    expect(todayStr(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });
});

describe("formatDate", () => {
  it("tidak menggeser hari", () => {
    expect(formatDate("2026-10-05")).toContain("05");
  });
  it("mengembalikan teks asli jika tidak valid", () => {
    expect(formatDate("bukan-tanggal")).toBe("bukan-tanggal");
  });
});

describe("monthLabel", () => {
  it("menampilkan nama bulan Indonesia", () => expect(monthLabel("2026-10")).toBe("Oktober 2026"));
});

describe("csvCell", () => {
  it("membiarkan teks biasa", () => expect(csvCell("Epinefrin")).toBe("Epinefrin"));
  it("membungkus koma dan menggandakan kutip", () => {
    expect(csvCell('Kasa 4 m x 6" cm, steril')).toBe('"Kasa 4 m x 6"" cm, steril"');
  });
});

describe("buildRecapCSV", () => {
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: "1",
    itemId: "a",
    itemName: "NaCl 0,9%",
    type: "keluar",
    qty: 2,
    date: "2026-10-02",
    note: "",
    operator: "Ani",
    createdAt: "2026-10-02T01:00:00Z",
    ...o,
  });
  it("mengurutkan per tanggal dan meng-escape sel", () => {
    const csv = buildRecapCSV(
      [tx({ id: "2", date: "2026-10-03", type: "masuk", voidedBy: "3" }), tx({ id: "1" })],
      "Oktober 2026",
      new Date(2026, 9, 5),
    );
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe("Periode: Oktober 2026");
    expect(lines[2]).toBe("Total Transaksi: 2 (Masuk: 1 | Keluar: 1)");
    expect(lines[6]).toBe('1,2026-10-02,"NaCl 0,9%",Keluar,2,,Ani,');
    expect(lines[7]).toBe('2,2026-10-03,"NaCl 0,9%",Masuk,2,,Ani,Dibatalkan');
  });
});

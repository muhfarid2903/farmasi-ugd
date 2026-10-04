import { describe, expect, it } from "vitest";
import { friendlyDate, greeting } from "../src/lib/date";
import { frequentItems, itemUsage, matchScore, normalize, searchItems } from "../src/lib/search";
import type { Item, Transaction } from "../src/types";

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({
  id,
  name,
  category: "Obat",
  unit: "ampul",
  stock: 5,
  minStock: 3,
  kritis: false,
  ...extra,
});

const items = [
  item("epi", "Epinefrin (adrenalin) inj 1 mg/ml", { kritis: true }),
  item("spuit3", "Alat suntik sekali pakai 3 ml", { kritis: true, stock: 38 }),
  item("rl", "Ringer Laktat Larutan (DAK)", { kritis: true, stock: 104 }),
  item("nacl", "NaCl 0,9% Larutan (DAK)", { kritis: true }),
  item("iv20", "I.V. Catheter No. 20", { kritis: true }),
  item("dex", "Deksametason inj 5 mg/ml (i.v./i.m.)"),
  item("amox", "Amoksisilin tab 500 mg (DAU)", { stock: 0 }),
];

describe("normalize", () => {
  it("huruf kecil tanpa tanda baca", () => expect(normalize("  NaCl 0,9% (DAK) ")).toBe("nacl 0 9 dak"));
});

describe("matchScore / searchItems", () => {
  const names = (q: string) => searchItems(items, q).map((i) => i.id);

  it("mencocokkan awal kata dan bagian kata", () => {
    expect(names("epi")).toEqual(["epi"]);
    expect(names("laktat")).toEqual(["rl"]);
  });
  it("semua kata harus cocok, urutan bebas", () => {
    expect(names("larutan dak")).toEqual(expect.arrayContaining(["rl", "nacl"]));
    expect(names("suntik 3")).toEqual(["spuit3"]);
  });
  it("tahan salah ketik sedikit", () => {
    expect(names("epinefin")).toContain("epi");
    expect(names("deksametazon")).toContain("dex");
    expect(names("amoksisillin")).toContain("amox");
  });
  it("memahami sebutan sehari-hari", () => {
    expect(names("adrenalin")).toEqual(["epi"]);
    expect(names("spuit")).toEqual(["spuit3"]);
    expect(names("abocath")).toEqual(["iv20"]);
    expect(names("rl")).toEqual(["rl"]);
  });
  it("tidak cocok jika berbeda jauh", () => {
    expect(matchScore("xyz", "Epinefrin")).toBe(0);
    expect(names("")).toEqual([]);
  });
  it("hasil yang sama skornya diurutkan dari yang sering dipakai", () => {
    const usage = new Map([["nacl", 9]]);
    expect(searchItems(items, "larutan", usage)[0].id).toBe("nacl");
  });
});

describe("itemUsage / frequentItems", () => {
  const tx = (itemId: string, date: string, extra: Partial<Transaction> = {}) =>
    ({ id: `${itemId}-${date}`, itemId, date, type: "keluar", qty: 1, ...extra }) as Transaction;
  const txs = [
    tx("rl", "2026-10-01"),
    tx("rl", "2026-10-02"),
    tx("epi", "2026-10-03"),
    tx("dex", "2026-01-01"), // terlalu lama
    tx("nacl", "2026-10-03", { voidedBy: "x" }), // dibatalkan
  ];

  it("menghitung pemakaian sejak tanggal tertentu, tanpa transaksi yang dibatalkan", () => {
    expect(itemUsage(txs, "2026-09-01")).toEqual(
      new Map([
        ["rl", 2],
        ["epi", 1],
      ]),
    );
  });
  it("urut dari yang paling sering, dilengkapi item kritis yang ada stoknya", () => {
    const freq = frequentItems(items, itemUsage(txs, "2026-09-01"), 4).map((i) => i.id);
    expect(freq.slice(0, 2)).toEqual(["rl", "epi"]);
    expect(freq).toHaveLength(4);
    expect(freq).not.toContain("amox");
  });
});

describe("greeting / friendlyDate", () => {
  it("salam sesuai jam", () => {
    expect(greeting(new Date(2026, 9, 5, 7))).toBe("Selamat pagi");
    expect(greeting(new Date(2026, 9, 5, 12))).toBe("Selamat siang");
    expect(greeting(new Date(2026, 9, 5, 16))).toBe("Selamat sore");
    expect(greeting(new Date(2026, 9, 5, 22))).toBe("Selamat malam");
    expect(greeting(new Date(2026, 9, 5, 2))).toBe("Selamat malam");
  });
  it("hari ini, kemarin, atau tanggal lengkap", () => {
    const now = new Date(2026, 9, 5, 9);
    expect(friendlyDate("2026-10-05", now)).toBe("Hari ini");
    expect(friendlyDate("2026-10-04", now)).toBe("Kemarin");
    expect(friendlyDate("2026-10-01", now)).toContain("Oktober 2026");
  });
});

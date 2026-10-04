import { describe, expect, it } from "vitest";
import {
  expiringItems,
  expiryAfterIncoming,
  expiryPatch,
  expiryStatus,
  expiryText,
  formatExpiry,
  monthsUntil,
} from "../src/lib/expiry";
import type { Item } from "../src/types";

const today = "2026-10-05";

describe("format & selisih bulan", () => {
  it("format pendek", () => expect(formatExpiry("2027-03")).toBe("Mar 2027"));
  it("selisih bulan melewati tahun", () => {
    expect(monthsUntil("2027-01", today)).toBe(3);
    expect(monthsUntil("2026-10", today)).toBe(0);
    expect(monthsUntil("2026-08", today)).toBe(-2);
  });
});

describe("expiryStatus / expiryText", () => {
  it("masih boleh dipakai sampai akhir bulan ED", () => {
    expect(expiryStatus("2026-10", today)).toBe("segera");
    expect(expiryText("2026-10", today)).toBe("habis bulan ini");
  });
  it("lewat, segera, aman", () => {
    expect(expiryStatus("2026-09", today)).toBe("lewat");
    expect(expiryStatus("2027-01", today)).toBe("segera");
    expect(expiryStatus("2027-02", today)).toBe("aman");
    expect(expiryText("2026-09", today)).toBe("sudah lewat");
    expect(expiryText("2026-12", today)).toBe("2 bulan lagi");
  });
});

describe("expiringItems", () => {
  const item = (id: string, stock: number, expiry?: string) => ({ id, stock, expiry }) as Item;
  it("hanya yang ada stoknya dan lewat/segera, urut paling dulu", () => {
    const list = [
      item("a", 5, "2027-06"),
      item("b", 2, "2026-12"),
      item("c", 0, "2026-01"),
      item("d", 3, "2026-07"),
      item("e", 4),
    ];
    expect(expiringItems(list, today).map((i) => i.id)).toEqual(["d", "b"]);
  });
});

describe("expiryAfterIncoming", () => {
  it("stok lama masih ada: simpan ED yang lebih cepat", () => {
    expect(expiryAfterIncoming({ stock: 3, expiry: "2027-01" }, "2028-05")).toBeUndefined();
    expect(expiryAfterIncoming({ stock: 3, expiry: "2028-05" }, "2027-01")).toBe("2027-01");
  });
  it("stok kosong atau ED belum ada: pakai ED baru", () => {
    expect(expiryAfterIncoming({ stock: 0, expiry: "2026-01" }, "2028-05")).toBe("2028-05");
    expect(expiryAfterIncoming({ stock: 4 }, "2028-05")).toBe("2028-05");
  });
});

describe("expiryPatch", () => {
  it("barang masuk dengan ED memperbarui ED terdekat", () => {
    expect(expiryPatch({ stock: 0 }, { type: "masuk", qty: 5, expiry: "2027-03" })).toBe("2027-03");
    expect(expiryPatch({ stock: 2, expiry: "2026-12" }, { type: "masuk", qty: 5, expiry: "2027-03" })).toBeUndefined();
  });
  it("barang masuk tanpa ED tidak mengubah apa pun", () => {
    expect(expiryPatch({ stock: 2, expiry: "2026-12" }, { type: "masuk", qty: 5 })).toBeUndefined();
  });
  it("barang keluar sampai habis mengosongkan ED", () => {
    expect(expiryPatch({ stock: 3, expiry: "2026-12" }, { type: "keluar", qty: 3 })).toBeNull();
    expect(expiryPatch({ stock: 3, expiry: "2026-12" }, { type: "keluar", qty: 2 })).toBeUndefined();
    expect(expiryPatch({ stock: 3 }, { type: "keluar", qty: 3 })).toBeUndefined();
  });
});

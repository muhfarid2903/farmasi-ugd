import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_URL, newAddressReady, onOldAddress } from "../src/lib/domain";

describe("pindah alamat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mengenali alamat lama", () => {
    expect(onOldAddress("muhfarid2903.github.io")).toBe(true);
    expect(onOldAddress("ugd.balanglompo.com")).toBe(false);
    expect(onOldAddress("localhost")).toBe(false);
  });
  it("alamat baru dianggap aktif hanya bila manifest e-Stok UGD terbaca", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ short_name: "e-Stok UGD" }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await newAddressReady()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${APP_URL}manifest.webmanifest`, { cache: "no-store" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await newAddressReady()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ short_name: "Lain" }) }));
    expect(await newAddressReady()).toBe(false);
    // Sertifikat belum terbit / tidak ada sinyal
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await newAddressReady()).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { backupDue, backupFilename, buildBackup, daysSince } from "../src/lib/backup";
import type { Item } from "../src/types";

describe("buildBackup", () => {
  it("menyertakan semua data, jumlahnya, dan keterangan", () => {
    const b = buildBackup(
      { items: [{ id: "a" } as Item], transactions: [], users: [], opname: [] },
      { project: "farmasi-ugd", takenBy: "admin@gmail.com", now: new Date("2026-10-05T01:00:00Z") },
    );
    expect(b).toMatchObject({
      app: "farmasi-ugd",
      version: 1,
      project: "farmasi-ugd",
      takenAt: "2026-10-05T01:00:00.000Z",
      takenBy: "admin@gmail.com",
      counts: { items: 1, transactions: 0, users: 0, opname: 0 },
    });
    expect(b.items[0].id).toBe("a");
  });
});

describe("backupFilename", () => {
  it("memakai tanggal & jam lokal", () => {
    expect(backupFilename(new Date(2026, 9, 5, 8, 3))).toBe("cadangan-farmasi-ugd-2026-10-05-0803.json");
  });
});

describe("daysSince / backupDue", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("menghitung hari penuh", () => {
    expect(daysSince("2026-10-09T13:00:00Z", now)).toBe(0);
    expect(daysSince("2026-10-03T12:00:00Z", now)).toBe(7);
    expect(daysSince(null, now)).toBeNull();
  });
  it("perlu cadangan jika belum pernah atau sudah ≥ 7 hari", () => {
    expect(backupDue(null, now)).toBe(true);
    expect(backupDue("2026-10-03T12:00:00Z", now)).toBe(true);
    expect(backupDue("2026-10-05T12:00:00Z", now)).toBe(false);
  });
});

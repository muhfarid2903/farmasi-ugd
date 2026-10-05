import type { Item, Opname, Transaction, UserProfile } from "../types";

export const BACKUP_VERSION = 1;

export interface BackupData {
  app: "farmasi-ugd";
  version: number;
  project: string;
  takenAt: string;
  takenBy: string;
  counts: { items: number; transactions: number; users: number; opname: number };
  items: Item[];
  transactions: Transaction[];
  users: UserProfile[];
  opname: Opname[];
}

/** Satu file cadangan berisi seluruh isi database, lengkap dengan id dokumen. */
export function buildBackup(
  data: { items: Item[]; transactions: Transaction[]; users: UserProfile[]; opname: Opname[] },
  meta: { project: string; takenBy: string; now?: Date },
): BackupData {
  return {
    app: "farmasi-ugd",
    version: BACKUP_VERSION,
    project: meta.project,
    takenAt: (meta.now ?? new Date()).toISOString(),
    takenBy: meta.takenBy,
    counts: {
      items: data.items.length,
      transactions: data.transactions.length,
      users: data.users.length,
      opname: data.opname.length,
    },
    ...data,
  };
}

/** "cadangan-farmasi-ugd-2026-10-05-0830.json" (waktu lokal) */
export function backupFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `cadangan-farmasi-ugd-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** Jumlah hari sejak cadangan terakhir; null jika belum pernah. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Cadangan dianggap perlu bila belum pernah atau sudah lebih dari 7 hari. */
export const BACKUP_REMIND_DAYS = 7;
export function backupDue(lastIso: string | null, now: Date = new Date()): boolean {
  const d = daysSince(lastIso, now);
  return d === null || d >= BACKUP_REMIND_DAYS;
}

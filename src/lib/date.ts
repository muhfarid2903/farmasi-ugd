const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal hari ini menurut jam perangkat (WITA), format YYYY-MM-DD. */
export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Format tanggal untuk tampilan. "YYYY-MM-DD" diparse sebagai tanggal lokal, bukan UTC. */
export function formatDate(d: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** "2026-10" → "Oktober 2026" */
export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return `${BULAN[Number(m) - 1] ?? m} ${y}`;
}

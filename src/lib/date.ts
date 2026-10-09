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

/** "2026-10" → "Oktober" */
export function monthName(yyyyMm: string): string {
  const m = yyyyMm.split("-")[1];
  return BULAN[Number(m) - 1] ?? m;
}

/** Geser bulan "YYYY-MM" sebanyak `delta` bulan, mis. ("2026-12", 1) → "2027-01". */
export function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Salam sesuai jam: pagi, siang, sore, atau malam. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Tanggal lengkap dengan nama hari, mis. "Senin, 5 Oktober 2026". */
export function fullDate(d: Date = new Date()): string {
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "Hari ini", "Kemarin", atau tanggal lengkap dengan nama hari. */
export function friendlyDate(d: string, now: Date = new Date()): string {
  const today = todayStr(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d === today) return "Hari ini";
  if (d === todayStr(y)) return "Kemarin";
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime()) ? d : fullDate(date);
}

/** Tanggal N hari sebelum hari ini, format YYYY-MM-DD. */
export function daysAgo(n: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

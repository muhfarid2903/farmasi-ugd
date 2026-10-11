/**
 * Asisten Stok Opname: mengisi kolom UGD di file stok opname puskesmas (Excel di Google Drive milik farmasi)
 * dari stok akhir bulan di aplikasi.
 *
 * File itu diisi banyak petugas, jadi bot tidak pernah menulis langsung. Bot membaca file, mencocokkan barang,
 * lalu menyiapkan satu kolom siap tempel. Letak tab, kolom, dan baris berubah tiap bulan, jadi semuanya dicari
 * lewat judul dan nama, tidak pernah lewat posisi tetap. Nama barang yang ragu ditanyakan sekali ke PJ UGD,
 * lalu jawabannya (padanan) disimpan per barang.
 */
import { monthLabel } from "./date";
import { activeItems, sameItemKey } from "./merge";
import { activeRows, monthlyRecap, type RecapRow } from "./recap";
import { normalize } from "./search";
import { colLetter, parseRange, type CellValue, type XlsxSheet, type XlsxWorkbook } from "./xlsx";
import type { Item, Transaction } from "../types";

// ---------- tab bulan ----------

const BULAN: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  peb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  agus: 8,
  agst: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nopember: 11,
  nov: 11,
  nop: 11,
  desember: 12,
  des: 12,
};

/** Bulan dan tahun dari nama tab: "oktober 2026" → 10 dan 2026, "NOP 2026" → 11, "MEI" → 5 tanpa tahun. */
export function tabPeriod(name: string): { month: number | null; year: number | null } {
  const words = name.toLowerCase().match(/[a-z]+|\d{4}/g) ?? [];
  const month = words.map((w) => BULAN[w]).find((m) => m !== undefined) ?? null;
  const year = words.find((w) => /^\d{4}$/.test(w));
  return { month, year: year ? Number(year) : null };
}

/** Tahun di kepala laporan (baris 2–6), untuk tab yang namanya tanpa tahun. */
export function labelYear(sheet: XlsxSheet): number | null {
  for (let r = 2; r <= 6; r++) {
    for (let c = 1; c <= Math.min(sheet.maxCol, 80); c++) {
      const m = /\b(20\d\d)\b/.exec(String(sheet.value(r, c) ?? ""));
      if (m) return Number(m[1]);
    }
  }
  return null;
}

export type TabSearch = { name: string } | { error: string; candidates: string[] };

/** Tab untuk bulan "YYYY-MM". Nama tab tidak seragam ("oktober 2026", "MEI", "NOP 2026"), jadi dicari lewat bulannya. */
export async function findMonthTab(wb: XlsxWorkbook, month: string): Promise<TabSearch> {
  const [y, m] = month.split("-").map(Number);
  const found: string[] = [];
  for (const name of wb.sheetNames) {
    const p = tabPeriod(name);
    if (p.month !== m) continue;
    const year = p.year ?? labelYear(await wb.sheet(name));
    if (year === y) found.push(name);
  }
  if (found.length === 1) return { name: found[0] };
  return found.length === 0
    ? { error: `Tab untuk ${monthLabel(month)} belum ada di file stok opname.`, candidates: [] }
    : { error: `Ada ${found.length} tab untuk ${monthLabel(month)}.`, candidates: found };
}

// ---------- isi tab ----------

export interface OpnameRow {
  row: number;
  name: string;
  unit: string;
  /** Isi kolom UGD saat file dibaca. */
  ugd: CellValue;
  /** Urutan kemunculan bila nama dan satuan yang sama tertulis lebih dari sekali. */
  ke: number;
}

export interface OpnameTab {
  name: string;
  ugdCol: number;
  rows: OpnameRow[];
  /** Rentang tempel: baris barang pertama sampai terakhir. */
  firstRow: number;
  lastRow: number;
  /** Isi kolom UGD dari firstRow sampai lastRow, termasuk baris tanpa nama barang. */
  column: CellValue[];
  /** Hal yang perlu diketahui sebelum menempel. */
  warnings: string[];
}

const cellText = (v: CellValue) => String(v ?? "");

export function isEmpty(v: CellValue): boolean {
  return v === null || (typeof v === "string" && v.trim() === "");
}

/** Angka dari isi sel; null bila kosong atau bukan angka. */
export function toNumber(v: CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return Number(v.trim().replace(",", "."));
  return null;
}

/** Baca satu tab stok opname: kolom dicari lewat judulnya, karena posisinya berubah tiap bulan. */
export function readOpnameTab(sheet: XlsxSheet): OpnameTab | { error: string } {
  let header: { row: number; col: number } | null = null;
  for (let r = 1; r <= 15 && !header; r++) {
    for (let c = 1; c <= Math.min(sheet.maxCol, 80); c++) {
      if (normalize(cellText(sheet.value(r, c))) === "nama obat") {
        header = { row: r, col: c };
        break;
      }
    }
  }
  if (!header) return { error: `Judul kolom "NAMA OBAT" tidak ditemukan di tab "${sheet.name}".` };
  const headerRow = header.row;
  const findCol = (label: string) => {
    for (const r of [headerRow, headerRow + 1]) {
      for (let c = 1; c <= sheet.maxCol; c++) if (normalize(cellText(sheet.value(r, c))) === label) return c;
    }
    return null;
  };
  const unitCol = findCol("satuan");
  const ugdCol = findCol("ugd");
  if (!ugdCol) return { error: `Kolom berjudul "UGD" tidak ditemukan di tab "${sheet.name}".` };

  const rows: OpnameRow[] = [];
  const seen = new Map<string, number>();
  for (let r = headerRow + 1; r <= sheet.maxRow; r++) {
    const name = sheet.value(r, header.col);
    if (typeof name !== "string" || !name.trim()) continue;
    const unit = unitCol ? cellText(sheet.value(r, unitCol)).trim() : "";
    const key = `${normalize(name)}|${normalize(unit)}`;
    const ke = (seen.get(key) ?? 0) + 1;
    seen.set(key, ke);
    rows.push({ row: r, name: name.trim(), unit, ugd: sheet.value(r, ugdCol), ke });
  }
  if (rows.length === 0) return { error: `Tab "${sheet.name}" tidak berisi daftar barang.` };
  const firstRow = rows[0].row;
  const lastRow = rows[rows.length - 1].row;
  const column: CellValue[] = [];
  for (let r = firstRow; r <= lastRow; r++) column.push(sheet.value(r, ugdCol));
  return {
    name: sheet.name,
    ugdCol,
    rows,
    firstRow,
    lastRow,
    column,
    warnings: tabWarnings(sheet, ugdCol, firstRow, lastRow),
  };
}

function rowList(rows: number[]): string {
  return rows.length > 5 ? `${rows.slice(0, 5).join(", ")}, dan ${rows.length - 5} lainnya` : rows.join(", ");
}

function tabWarnings(sheet: XlsxSheet, ugdCol: number, firstRow: number, lastRow: number): string[] {
  const col = colLetter(ugdCol);
  const out: string[] = [];
  for (const t of sheet.tables) {
    const r = parseRange(t.ref);
    if (!r || ugdCol < r.c1 || ugdCol > r.c2 + 1 || r.r2 < firstRow || r.r1 > lastRow) continue;
    out.push(
      `Ada tabel Excel ("${t.name}", ${t.ref}) ${ugdCol > r.c2 ? "tepat di sebelah" : "yang mencakup"} kolom UGD. ` +
        `Saat diisi, tabel itu bisa melebar dan menulis judul "Kolom …" di sel ${col}${r.r1}. ` +
        `Sebaiknya pengelola file mengubah tabel itu jadi rentang biasa dulu.`,
    );
  }
  const hidden = [...sheet.hiddenRows].filter((r) => r >= firstRow && r <= lastRow).sort((a, b) => a - b);
  if (hidden.length) {
    out.push(
      `Ada ${hidden.length} baris yang disembunyikan (baris ${rowList(hidden)}). ` +
        `Tampilkan semua baris dulu sebelum menempel, supaya angkanya tidak bergeser.`,
    );
  }
  const formulas: number[] = [];
  const decimals: number[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    if (sheet.hasFormula(r, ugdCol)) formulas.push(r);
    const v = sheet.value(r, ugdCol);
    if (typeof v === "number" && !Number.isInteger(v)) decimals.push(r);
  }
  if (formulas.length) {
    out.push(`Kolom UGD berisi rumus di baris ${rowList(formulas)}. Menempel akan menggantinya dengan angka.`);
  }
  if (decimals.length) {
    out.push(`Kolom UGD berisi angka desimal di baris ${rowList(decimals)}. Periksa baris itu lagi setelah menempel.`);
  }
  return out;
}

// ---------- stok dari aplikasi ----------

const DIHAPUS = " (sudah dihapus)";

/** Barang aplikasi untuk satu bulan; barang yang namanya sama dikelompokkan dan stoknya dijumlah. */
export interface StockLine {
  key: string;
  itemIds: string[];
  /** Nama di aplikasi (tanpa keterangan "sudah dihapus"). */
  name: string;
  /** Satuan, atau rinciannya bila satuan barang-barang bernama sama itu berbeda. */
  unit: string;
  /** Stok akhir bulan. */
  stock: number;
  /** Sudah dihapus dari aplikasi tetapi masih punya riwayat bulan itu. */
  deleted: boolean;
  mixedUnits: boolean;
  /** Jumlah barang aplikasi dalam kelompok ini. */
  count: number;
}

export function stockLines(rows: RecapRow[], activeIds: ReadonlySet<string>): StockLine[] {
  const groups = new Map<string, { name: string; deleted: boolean; rows: RecapRow[] }>();
  for (const r of rows) {
    const deleted = !activeIds.has(r.itemId);
    const name = r.itemName.endsWith(DIHAPUS) ? r.itemName.slice(0, -DIHAPUS.length) : r.itemName;
    const key = `${deleted ? "x:" : ""}${normalize(name)}`;
    const g = groups.get(key) ?? { name, deleted, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => {
    const mixedUnits = new Set(g.rows.map((r) => normalize(r.unit))).size > 1;
    return {
      key,
      itemIds: g.rows.map((r) => r.itemId),
      name: g.name,
      unit: mixedUnits ? g.rows.map((r) => `${r.end} ${r.unit}`).join(" + ") : g.rows[0].unit,
      stock: g.rows.reduce((sum, r) => sum + r.end, 0),
      deleted: g.deleted,
      mixedUnits,
      count: g.rows.length,
    };
  });
}

/** Stok akhir bulan "YYYY-MM" per barang, sama dengan angka di rekap dan LPLPO. */
export function monthLines(allItems: Item[], transactions: Transaction[], month: string): StockLine[] {
  const active = new Set(activeItems(allItems).map((i) => i.id));
  return stockLines(activeRows(monthlyRecap(allItems, transactions, month)), active);
}

// ---------- padanan nama ----------

/** Jawaban PJ UGD tentang baris mana di file stok opname untuk satu barang aplikasi. */
export interface PadananEntry {
  /** Nama baris di file (bisa beberapa, bila tiap tab menulisnya berbeda). */
  nama?: string[];
  /** Satuan baris, bila nama yang sama tertulis dengan satuan berbeda. */
  satuan?: string;
  /** Urutan baris, bila nama dan satuannya sama-sama kembar. */
  ke?: number;
  /** Barang ini tidak dicatat di file stok opname. */
  lewati?: boolean;
  /** Barang bernama sama dengan satuan berbeda boleh dijumlahkan. */
  jumlahkan?: boolean;
  /** Nama barang di aplikasi saat dijawab, untuk ditampilkan. */
  label?: string;
}

/** itemId → padanan. */
export type PadananMap = Record<string, PadananEntry>;

export function padananOf(line: StockLine, map: PadananMap): PadananEntry | undefined {
  for (const id of line.itemIds) if (map[id]) return map[id];
  return undefined;
}

// ---------- pencocokan ----------

export type MatchKind =
  | "padanan"
  | "persis"
  | "lewati"
  | "ganda"
  | "sumber-dana"
  | "mirip"
  | "berubah"
  | "tidak-ada"
  | "dihapus"
  | "satuan-beda";

export interface Match {
  kind: MatchKind;
  /** Baris yang cocok (padanan/persis), atau calon untuk ditanyakan. */
  rows: OpnameRow[];
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Kemiripan dua nama (0–1), dari pasangan huruf yang sama (koefisien Dice). */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bx = bigrams(x);
  const by = bigrams(y);
  let shared = 0;
  for (const [g, n] of bx) shared += Math.min(n, by.get(g) ?? 0);
  return (2 * shared) / (x.length - 1 + (y.length - 1));
}

/** Baris yang namanya mirip, paling mirip dulu. Nama yang dipotong (mis. "sekali pakai 3 ml") tetap ikut. */
export function similarRows(name: string, rows: OpnameRow[], limit = 4): OpnameRow[] {
  const words = new Set(normalize(name).split(" ").filter(Boolean));
  return rows
    .map((r) => {
      const rowWords = new Set(normalize(r.name).split(" ").filter(Boolean));
      let score = similarity(name, r.name);
      if (words.size > 0 && [...words].every((w) => rowWords.has(w))) score = Math.max(score, 0.75);
      else if (rowWords.size >= 2 && [...rowWords].every((w) => words.has(w))) score = Math.max(score, 0.7);
      return { r, score };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.r.row - b.r.row)
    .slice(0, limit)
    .map((x) => x.r);
}

/** Baris yang namanya memuat semua kata pencarian (untuk "cari baris lain"). */
export function searchRows(query: string, rows: OpnameRow[], limit = 8): OpnameRow[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  return rows.filter((r) => words.every((w) => normalize(r.name).includes(w))).slice(0, limit);
}

function matchName(line: StockLine, rows: OpnameRow[], p: PadananEntry | undefined): Match {
  if (p?.lewati) return { kind: "lewati", rows: [] };
  const ke = p?.ke ?? 1;
  for (const nama of p?.nama ?? []) {
    const found = rows.filter(
      (r) => normalize(r.name) === normalize(nama) && (!p?.satuan || normalize(r.unit) === normalize(p.satuan)),
    );
    if (found.length >= ke) return { kind: "padanan", rows: [found[ke - 1]] };
  }
  // Padanan tidak ketemu di tab ini (nama ditulis lain bulan ini): coba nama persis dulu sebelum bertanya
  let persis = rows.filter((r) => normalize(r.name) === normalize(line.name));
  if (persis.length > 1 && normalize(line.unit)) {
    const sameUnit = persis.filter((r) => normalize(r.unit) === normalize(line.unit));
    if (sameUnit.length === 1) persis = sameUnit;
  }
  if (persis.length === 1) return { kind: "persis", rows: persis };
  const key = sameItemKey(line.name);
  const funding = rows.filter((r) => !persis.includes(r) && sameItemKey(r.name) === key);
  if (persis.length > 1) return { kind: "ganda", rows: [...persis, ...funding] };
  if (p?.nama?.length) return { kind: "berubah", rows: similarRows(p.nama[0], rows) };
  if (funding.length) return { kind: "sumber-dana", rows: funding };
  const mirip = similarRows(line.name, rows);
  return { kind: mirip.length ? "mirip" : "tidak-ada", rows: mirip };
}

export function matchLine(line: StockLine, rows: OpnameRow[], p: PadananEntry | undefined): Match {
  const m = matchName(line, rows, p);
  if ((m.kind === "persis" || m.kind === "padanan") && line.mixedUnits && !p?.jumlahkan) {
    return { kind: "satuan-beda", rows: m.rows };
  }
  // Barang yang sudah dihapus tidak pernah diisi otomatis
  if (line.deleted && m.kind !== "lewati" && m.kind !== "padanan") {
    return { kind: "dihapus", rows: m.rows.length ? m.rows : similarRows(line.name, rows) };
  }
  return m;
}

// ---------- rencana isian ----------

export interface PlanCell {
  /** isi = sel masih kosong; ganti/kosongkan = sel sudah berisi angka lain (perlu persetujuan). */
  action: "isi" | "ganti" | "kosongkan";
  row: OpnameRow;
  value: number | null;
  lines: StockLine[];
}

export interface Question {
  line: StockLine;
  kind: MatchKind;
  rows: OpnameRow[];
}

export interface Plan {
  cells: PlanCell[];
  /** Sel yang isinya sudah sesuai. */
  alreadyOk: number;
  questions: Question[];
  skipped: StockLine[];
  /** Barang berstok 0 yang tidak cocok persis: tidak ditanyakan dan tidak ditulis. */
  zeroUnmatched: number;
  /** Sel UGD sudah berisi, tetapi barangnya tidak ada di rekap aplikasi bulan itu. */
  leftovers: OpnameRow[];
}

export function buildPlan(lines: StockLine[], tab: OpnameTab, padanan: PadananMap): Plan {
  const byRow = new Map<number, { row: OpnameRow; value: number; lines: StockLine[] }>();
  const questions: Question[] = [];
  const skipped: StockLine[] = [];
  let zeroUnmatched = 0;
  for (const line of lines) {
    const m = matchLine(line, tab.rows, padananOf(line, padanan));
    if (m.kind === "lewati") {
      skipped.push(line);
    } else if (m.kind === "persis" || m.kind === "padanan") {
      const target = m.rows[0];
      const e = byRow.get(target.row) ?? { row: target, value: 0, lines: [] };
      e.value += line.stock;
      e.lines.push(line);
      byRow.set(target.row, e);
    } else if (!line.stock) {
      zeroUnmatched++;
    } else {
      questions.push({ line, kind: m.kind, rows: m.rows });
    }
  }
  const cells: PlanCell[] = [];
  let alreadyOk = 0;
  for (const e of [...byRow.values()].sort((a, b) => a.row.row - b.row.row)) {
    const value = e.value || null;
    const old = isEmpty(e.row.ugd) ? null : e.row.ugd;
    if (old === null && value === null) continue;
    if (old !== null && toNumber(old) === value) {
      alreadyOk++;
      continue;
    }
    cells.push({
      action: old === null ? "isi" : value === null ? "kosongkan" : "ganti",
      row: e.row,
      value,
      lines: e.lines,
    });
  }
  const leftovers = tab.rows.filter((r) => !isEmpty(r.ugd) && !byRow.has(r.row));
  return { cells, alreadyOk, questions, skipped, zeroUnmatched, leftovers };
}

/** Sel yang benar-benar diubah: sel kosong selalu, sel yang sudah berisi hanya bila disetujui. */
export function cellsToWrite(plan: Plan, replaceExisting: boolean): PlanCell[] {
  return plan.cells.filter((c) => c.action === "isi" || replaceExisting);
}

/** Jawaban untuk satu pertanyaan → padanan untuk semua barang aplikasi di kelompok itu. */
export function answerEntries(
  line: StockLine,
  answer: { row: OpnameRow; jumlahkan?: boolean } | { lewati: true },
  rows: OpnameRow[],
  previous: PadananEntry | undefined,
): PadananMap {
  let entry: PadananEntry;
  if ("lewati" in answer) {
    entry = { lewati: true, label: line.name };
  } else {
    const chosen = answer.row;
    const sameName = rows.filter((r) => normalize(r.name) === normalize(chosen.name));
    const sameUnit = sameName.filter((r) => normalize(r.unit) === normalize(chosen.unit));
    entry = {
      // Nama terbaru di depan; nama lama tetap disimpan untuk tab bulan lain yang menulisnya begitu
      nama: [chosen.name, ...(previous?.nama ?? []).filter((n) => normalize(n) !== normalize(chosen.name))],
      label: line.name,
    };
    if (sameName.length > 1) entry.satuan = chosen.unit;
    if (sameUnit.length > 1) entry.ke = chosen.ke;
    if (answer.jumlahkan) entry.jumlahkan = true;
  }
  return Object.fromEntries(line.itemIds.map((id) => [id, entry]));
}

// ---------- kolom tempel dan pemeriksaan ----------

function pasteCell(v: CellValue): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v).replace(/[\t\r\n]+/g, " ");
}

/**
 * Satu kolom utuh dari baris barang pertama sampai terakhir, siap ditempel mulai sel UGD baris pertama.
 * Sel yang tidak diubah tetap berisi nilai lamanya, jadi menempel kolom ini tidak menghapus apa pun.
 */
export function pasteText(tab: OpnameTab, cells: PlanCell[]): string {
  const updates = new Map(cells.map((c) => [c.row.row, c.value]));
  const lines: string[] = [];
  for (let r = tab.firstRow; r <= tab.lastRow; r++) {
    lines.push(pasteCell(updates.has(r) ? (updates.get(r) ?? null) : tab.column[r - tab.firstRow]));
  }
  return lines.join("\n");
}

const rowKey = (r: OpnameRow) => `${normalize(r.name)}|${normalize(r.unit)}|${r.ke}`;

function sameValue(a: CellValue, b: CellValue): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  const x = toNumber(a);
  const y = toNumber(b);
  if (x !== null && y !== null) return x === y;
  return cellText(a).trim() === cellText(b).trim();
}

export interface CheckDiff {
  name: string;
  /** Baris di file terbaru; null bila barisnya tidak ditemukan lagi. */
  row: number | null;
  expected: CellValue;
  actual: CellValue;
  /** true bila sel ini memang direncanakan diisi; false bila sel lain ikut berubah (tempelan bergeser). */
  planned: boolean;
}

export interface CheckResult {
  ok: number;
  total: number;
  diffs: CheckDiff[];
  /** Sel UGD yang berisi teks, bukan angka (mis. judul "Kolom 3" dari tabel yang melebar). */
  texts: OpnameRow[];
}

/**
 * Judul yang ditulis tabel Excel saat melebar ke kolom UGD, mis. "Kolom 3", atau "Kolom 1 2" setelah Google
 * memberi nama ulang karena sel judulnya ditempeli kosong. Bukan akibat tempelan yang bergeser.
 */
export const isTableHeader = (v: CellValue) => typeof v === "string" && /^kolom(\s*\d+)+$/i.test(v.trim());

/**
 * Bandingkan kolom UGD di file terbaru dengan yang seharusnya. Baris dicocokkan lewat nama, satuan, dan urutan,
 * karena baris bisa bergeser bila ada yang menyisipkan baris setelah rencana dibuat.
 * Judul tabel yang melebar tidak dihitung sebagai kesalahan tempel; ia dilaporkan lewat `texts`.
 */
export function checkPaste(original: OpnameTab, written: PlanCell[], fresh: OpnameTab): CheckResult {
  const updates = new Map(written.map((c) => [rowKey(c.row), c.value as CellValue]));
  const expected = new Map(
    original.rows.map((r) => [rowKey(r), updates.has(rowKey(r)) ? updates.get(rowKey(r))! : r.ugd]),
  );
  const seen = new Set<string>();
  const diffs: CheckDiff[] = [];
  let ok = 0;
  for (const r of fresh.rows) {
    const k = rowKey(r);
    if (!expected.has(k)) continue;
    seen.add(k);
    const want = expected.get(k) ?? null;
    const same = sameValue(want, r.ugd);
    if (same && updates.has(k)) ok++;
    if (!same && (updates.has(k) || !isTableHeader(r.ugd))) {
      diffs.push({ name: r.name, row: r.row, expected: want, actual: r.ugd, planned: updates.has(k) });
    }
  }
  for (const c of written) {
    if (!seen.has(rowKey(c.row))) {
      diffs.push({ name: c.row.name, row: null, expected: c.value, actual: null, planned: true });
    }
  }
  const texts = fresh.rows.filter((r) => !isEmpty(r.ugd) && toNumber(r.ugd) === null);
  return { ok, total: written.length, diffs, texts };
}

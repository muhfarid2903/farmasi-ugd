/**
 * Pembaca file Excel (.xlsx) sederhana, cukup untuk file stok opname puskesmas: nama tab, isi sel,
 * baris tersembunyi, dan tabel Excel. Tanpa pustaka tambahan: arsip zip dibuka dengan DecompressionStream
 * bawaan browser, dan XML dibaca dengan pola sederhana (file dari Excel dan Google Spreadsheet tersusun rapi).
 */

export type CellValue = string | number | boolean | null;

export interface XlsxTable {
  name: string;
  /** Rentang tabel, mis. "J11:K337". */
  ref: string;
}

export interface XlsxSheet {
  name: string;
  maxRow: number;
  maxCol: number;
  /** Nilai sel; baris dan kolom mulai dari 1. */
  value(row: number, col: number): CellValue;
  /** true bila sel berisi rumus. */
  hasFormula(row: number, col: number): boolean;
  /** Baris yang disembunyikan (mis. oleh filter). */
  hiddenRows: ReadonlySet<number>;
  tables: XlsxTable[];
}

export interface XlsxWorkbook {
  sheetNames: string[];
  /** Isi satu tab; baru dibuka saat diminta. */
  sheet(name: string): Promise<XlsxSheet>;
}

export class XlsxError extends Error {}

const BUKAN_XLSX = "Ini bukan file Excel (.xlsx).";
const decoder = new TextDecoder();

// ---------- arsip zip ----------

interface ZipEntry {
  method: number;
  compSize: number;
  offset: number;
}

function zipEntries(buf: Uint8Array<ArrayBuffer>): Map<string, ZipEntry> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Penutup arsip (End Of Central Directory) ada di akhir file, sebelum komentar opsional
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 0xffff - 22); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError(BUKAN_XLSX);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let k = 0; k < count; k++) {
    if (p + 46 > buf.length || view.getUint32(p, true) !== 0x02014b50) throw new XlsxError("File Excel rusak.");
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    entries.set(decoder.decode(buf.subarray(p + 46, p + 46 + nameLen)), {
      method: view.getUint16(p + 10, true),
      compSize: view.getUint32(p + 20, true),
      offset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function entryText(buf: Uint8Array<ArrayBuffer>, entry: ZipEntry): Promise<string> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new XlsxError("File Excel rusak.");
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const data = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return decoder.decode(data);
  if (entry.method !== 8) throw new XlsxError("File Excel memakai pemadatan yang tidak dikenal.");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// ---------- XML ----------

function decodeXml(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, e: string) => {
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "amp") return "&";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = decodeXml(m[2]);
  return out;
}

/** Gabungan semua teks <t> (teks bergaya dipecah jadi beberapa <t>); ejaan fonetik <rPh> diabaikan. */
function textOf(xml: string): string {
  let s = "";
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
    s += decodeXml(m[1]);
  }
  return s;
}

function resolvePath(fromFile: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromFile.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

function relsPathOf(file: string): string {
  const i = file.lastIndexOf("/");
  return `${file.slice(0, i)}/_rels/${file.slice(i + 1)}.rels`;
}

interface Rel {
  type: string;
  path: string;
}

function relationships(xml: string | null, fromFile: string): Map<string, Rel> {
  const out = new Map<string, Rel>();
  for (const m of (xml ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.Id && a.Target && a.TargetMode !== "External") {
      out.set(a.Id, { type: a.Type ?? "", path: resolvePath(fromFile, a.Target) });
    }
  }
  return out;
}

// ---------- alamat sel ----------

/** "B" → 2, "AJ" → 36 */
export function colNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 2 → "B", 36 → "AJ" */
export function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "J11:K337" → kolom dan baris awal/akhir; "G19" dianggap rentang satu sel. */
export function parseRange(ref: string): { c1: number; r1: number; c2: number; r2: number } | null {
  const m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(ref.trim());
  if (!m) return null;
  const c1 = colNumber(m[1]);
  const r1 = Number(m[2]);
  return { c1, r1, c2: m[3] ? colNumber(m[3]) : c1, r2: m[4] ? Number(m[4]) : r1 };
}

// ---------- isi tab ----------

const KEY = (row: number, col: number) => row * 16384 + col;

function parseSheet(name: string, xml: string, shared: string[], tables: XlsxTable[]): XlsxSheet {
  const values = new Map<number, CellValue>();
  const formulas = new Set<number>();
  const hiddenRows = new Set<number>();
  let maxRow = 0;
  let maxCol = 0;
  let rowNo = 0;
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = attrs(rm[1]);
    rowNo = ra.r ? Number(ra.r) : rowNo + 1;
    if (ra.hidden === "1" || ra.hidden === "true") hiddenRows.add(rowNo);
    let colNo = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(cm[1]);
      const ref = ca.r ? /^([A-Z]+)(\d+)$/i.exec(ca.r) : null;
      colNo = ref ? colNumber(ref[1]) : colNo + 1;
      const inner = cm[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: CellValue;
      switch (ca.t) {
        case "s":
          value = v === undefined ? null : (shared[Number(v)] ?? null);
          break;
        case "inlineStr":
          value = textOf(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? "");
          break;
        case "str":
        case "e":
        case "d":
          value = v === undefined ? null : decodeXml(v);
          break;
        case "b":
          value = v === undefined ? null : v === "1";
          break;
        default:
          value = v === undefined || v === "" ? null : Number(v);
      }
      const key = KEY(rowNo, colNo);
      if (/<f\b/.test(inner)) formulas.add(key);
      if (value !== null) {
        values.set(key, value);
        maxRow = Math.max(maxRow, rowNo);
        maxCol = Math.max(maxCol, colNo);
      }
    }
  }
  return {
    name,
    maxRow,
    maxCol,
    hiddenRows,
    tables,
    value: (row, col) => values.get(KEY(row, col)) ?? null,
    hasFormula: (row, col) => formulas.has(KEY(row, col)),
  };
}

/** Buka file .xlsx. Hanya daftar tab yang dibaca di awal; isi tab dibaca saat diminta. */
export async function readXlsx(input: ArrayBuffer): Promise<XlsxWorkbook> {
  const buf = new Uint8Array(input);
  if (buf.length < 22 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new XlsxError(BUKAN_XLSX);
  const entries = zipEntries(buf);
  const read = async (path: string) => {
    const e = entries.get(path);
    return e ? entryText(buf, e) : null;
  };

  const wbPath = "xl/workbook.xml";
  const wbXml = await read(wbPath);
  if (!wbXml) throw new XlsxError(BUKAN_XLSX);
  const wbRels = relationships(await read(relsPathOf(wbPath)), wbPath);
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const a = attrs(m[0]);
    const rid = Object.entries(a).find(([k]) => k.endsWith(":id"))?.[1] ?? "";
    return { name: a.name ?? "", path: wbRels.get(rid)?.path ?? "" };
  });

  let shared: Promise<string[]> | null = null;
  const sharedStrings = () =>
    (shared ??= (async () => {
      const rel = [...wbRels.values()].find((r) => r.type.endsWith("/sharedStrings"));
      const xml = await read(rel?.path ?? "xl/sharedStrings.xml");
      return [...(xml ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) => textOf(m[1] ?? ""));
    })());

  const cache = new Map<string, Promise<XlsxSheet>>();
  const loadSheet = async (name: string): Promise<XlsxSheet> => {
    const info = sheets.find((s) => s.name === name);
    const xml = info && (await read(info.path));
    if (!info || !xml) throw new XlsxError(`Tab "${name}" tidak ditemukan di file.`);
    const tables: XlsxTable[] = [];
    for (const rel of relationships(await read(relsPathOf(info.path)), info.path).values()) {
      if (!rel.type.endsWith("/table")) continue;
      const tableXml = await read(rel.path);
      const tag = tableXml && /<table\b[^>]*>/.exec(tableXml)?.[0];
      if (!tag) continue;
      const a = attrs(tag);
      if (a.ref) tables.push({ name: a.displayName ?? a.name ?? "", ref: a.ref });
    }
    return parseSheet(name, xml, await sharedStrings(), tables);
  };

  return {
    sheetNames: sheets.map((s) => s.name),
    sheet(name) {
      let p = cache.get(name);
      if (!p) {
        p = loadSheet(name);
        cache.set(name, p);
      }
      return p;
    },
  };
}

/**
 * Mengambil file stok opname puskesmas dari Google Drive dengan kunci API khusus (dibatasi untuk Drive API dan
 * alamat aplikasi). Kunci API hanya bisa membaca file yang dibagikan "siapa saja yang memiliki link".
 * Kuncinya disimpan admin di database, bukan di kode.
 */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** id file dari link Drive/Spreadsheet ("…/d/<id>/edit", "…?id=<id>"), atau id itu sendiri. */
export function driveFileId(link: string): string | null {
  const s = link.trim();
  const m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(s) ?? /[?&]id=([A-Za-z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : null;
}

/** Alamat untuk membuka file di Google Spreadsheet. */
export function sheetUrl(fileId: string): string {
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
}

export type DriveErrorReason = "kunci" | "akses" | "jaringan" | "lain";

export class DriveError extends Error {
  reason: DriveErrorReason;
  constructor(message: string, reason: DriveErrorReason) {
    super(message);
    this.reason = reason;
  }
}

/** Alasan penolakan dari jawaban error Google API. */
async function errorReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] };
    };
    return (
      body.error?.details?.find((d) => d.reason)?.reason ?? body.error?.errors?.find((e) => e.reason)?.reason ?? ""
    );
  } catch {
    return "";
  }
}

const KEY_REASONS = new Set([
  "API_KEY_SERVICE_BLOCKED",
  "API_KEY_HTTP_REFERRER_BLOCKED",
  "API_KEY_INVALID",
  "SERVICE_DISABLED",
  "accessNotConfigured",
  "keyInvalid",
  "badRequest",
]);

export function driveErrorFor(status: number, reason: string): DriveError {
  if (KEY_REASONS.has(reason) || status === 400) {
    return new DriveError(
      "Kunci Drive API belum bisa dipakai: Drive API belum aktif, kuncinya salah, atau kunci itu tidak mengizinkan alamat aplikasi ini.",
      "kunci",
    );
  }
  if (status === 403 || status === 404) {
    return new DriveError(
      'File tidak bisa dibuka. Mungkin file dihapus, atau tidak lagi dibagikan "siapa saja yang memiliki link".',
      "akses",
    );
  }
  return new DriveError(
    `Google Drive menjawab ${status}${reason ? ` (${reason})` : ""}. Coba lagi sebentar lagi.`,
    "lain",
  );
}

/** Unduh isi file sebagai .xlsx. File Google Spreadsheet asli diekspor ke .xlsx. */
export async function fetchDriveXlsx(
  fileId: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const key = `key=${encodeURIComponent(apiKey)}`;
  const get = async (url: string) => {
    try {
      return await fetchFn(url, { cache: "no-store" });
    } catch {
      throw new DriveError("Tidak bisa menghubungi Google Drive. Periksa sinyal lalu coba lagi.", "jaringan");
    }
  };
  let res = await get(`${base}?alt=media&${key}`);
  if (!res.ok) {
    const reason = await errorReason(res);
    if (reason !== "fileNotDownloadable") throw driveErrorFor(res.status, reason);
    res = await get(`${base}/export?mimeType=${encodeURIComponent(XLSX_MIME)}&${key}`);
    if (!res.ok) throw driveErrorFor(res.status, await errorReason(res));
  }
  return res.arrayBuffer();
}

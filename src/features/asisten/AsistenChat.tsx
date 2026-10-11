import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { monthLabel, shiftMonth, todayStr } from "../../lib/date";
import { DriveError, driveFileId, fetchDriveXlsx, sheetUrl } from "../../lib/drive";
import type { StokOpnameMeta } from "../../lib/repository";
import {
  answerEntries,
  buildPlan,
  cellsToWrite,
  checkPaste,
  findMonthTab,
  isTableHeader,
  monthLines,
  padananOf,
  pasteText,
  readOpnameTab,
  searchRows,
  type CheckResult,
  type OpnameRow,
  type OpnameTab,
  type PadananMap,
  type Plan,
  type Question,
  type StockLine,
} from "../../lib/stokOpname";
import { colLetter, readXlsx, XlsxError, type CellValue, type XlsxWorkbook } from "../../lib/xlsx";
import type { Item, Transaction } from "../../types";

export interface FileSettings {
  fileId: string;
  link: string;
  driveKey: string;
}

export interface AsistenChatProps {
  allItems: Item[];
  transactions: Transaction[];
  /** undefined = masih dimuat; null = belum diatur. */
  meta: StokOpnameMeta | null | undefined;
  padanan: PadananMap;
  onSaveMeta: (file: FileSettings) => void;
  onSavePadanan: (entries: PadananMap) => void;
  /** Ambil file dari Drive; bisa diganti untuk uji coba. */
  fetchFile?: (fileId: string, driveKey: string) => Promise<ArrayBuffer>;
  notify: (text: string, kind: "success" | "error") => void;
}

type Source = "drive" | "unggah";

interface Ctx {
  month: string;
  source: Source;
  tab: OpnameTab;
  lines: StockLine[];
  plan: Plan;
  /** Jawaban dalam sesi ini, dipakai langsung walau belum tersimpan ke server. */
  answered: PadananMap;
  replaceExisting: boolean;
}

type Stage =
  | { kind: "pengaturan" }
  | { kind: "bulan" }
  | { kind: "memuat"; text: string }
  | { kind: "unggah"; month: string; ctx?: Ctx }
  | { kind: "pilih-tab"; month: string; source: Source; wb: XlsxWorkbook; candidates: string[] }
  | { kind: "tanya"; ctx: Ctx; questions: Question[]; index: number }
  | { kind: "pratinjau"; ctx: Ctx }
  | { kind: "tempel"; ctx: Ctx; text: string; showText: boolean }
  | { kind: "hasil"; ctx: Ctx; result: CheckResult };

interface Bubble {
  from: "bot" | "saya";
  text: string;
  tone?: "ok" | "warn" | "error";
}

type Choice = { row: OpnameRow; jumlahkan?: boolean } | { lewati: true } | "nanti";

const fmt = (n: number) => n.toLocaleString("id-ID");
const rowLabel = (r: OpnameRow) => `Baris ${r.row}: ${r.name}${r.unit ? ` [${r.unit}]` : ""}`;
const show = (v: CellValue) => (v === null || v === "" ? "kosong" : String(v));

const REASON: Record<string, string> = {
  ganda: "Nama ini tertulis di beberapa baris. Pilih barisnya:",
  "sumber-dana": "Di file stok opname, barang ini dipisah per sumber dana. Pilih barisnya:",
  mirip: "Nama persisnya tidak ada di file. Mungkin salah satu ini:",
  berubah: "Baris yang dulu Anda pilih tidak ada di tab ini (namanya ditulis lain). Mungkin salah satu ini:",
  "tidak-ada": "Saya tidak menemukan barang ini di file. Cari barisnya di bawah, atau lewati.",
  dihapus:
    "Barang ini sudah dihapus dari aplikasi, tapi di akhir bulan ini masih tercatat ada stoknya. Kalau stoknya memang ada, pilih barisnya. Kalau tidak, lewati.",
};

/** Percakapan PJ UGD dengan bot: pilih bulan → ambil file → jawab yang ragu → pratinjau → tempel → periksa. */
export function AsistenChat({
  allItems,
  transactions,
  meta,
  padanan,
  onSaveMeta,
  onSavePadanan,
  fetchFile = fetchDriveXlsx,
  notify,
}: AsistenChatProps) {
  const [log, setLog] = useState<Bubble[]>([]);
  const [started, setStarted] = useState<Stage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Sebelum ada langkah, mulai dari pengaturan (bila file belum diatur) atau pilih bulan
  const stage: Stage | null =
    started ?? (meta === undefined ? null : meta ? { kind: "bulan" } : { kind: "pengaturan" });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log.length, stage?.kind]);

  const say = (from: Bubble["from"], text: string, tone?: Bubble["tone"]) =>
    setLog((l) => [...l, { from, text, tone }]);

  async function fromDrive(): Promise<ArrayBuffer> {
    if (!meta?.driveKey) throw new DriveError("Pengambilan otomatis dari Drive belum diatur.", "kunci");
    return fetchFile(meta.fileId, meta.driveKey);
  }

  async function chooseMonth(month: string) {
    say("saya", monthLabel(month));
    if (!meta?.driveKey) {
      say("bot", "Pengambilan otomatis dari Drive belum diatur, jadi untuk sekarang file-nya perlu diunggah.");
      setStarted({ kind: "unggah", month });
      return;
    }
    setStarted({ kind: "memuat", text: "Saya ambil file stok opname terbaru dari Drive…" });
    try {
      await openWorkbook(month, await fromDrive(), "drive");
    } catch (e) {
      say("bot", `Saya belum bisa mengambil file dari Drive. ${e instanceof Error ? e.message : ""}`, "warn");
      setStarted({ kind: "unggah", month });
    }
  }

  async function openWorkbook(month: string, data: ArrayBuffer, source: Source) {
    let wb: XlsxWorkbook;
    try {
      wb = await readXlsx(data);
    } catch (e) {
      say("bot", e instanceof XlsxError ? e.message : "File itu tidak bisa dibaca.", "error");
      setStarted({ kind: "unggah", month });
      return;
    }
    const found = await findMonthTab(wb, month);
    if ("name" in found) {
      await openTab(month, wb, found.name, source);
    } else {
      say("bot", `${found.error} Tab mana yang dipakai?`, "warn");
      setStarted({ kind: "pilih-tab", month, source, wb, candidates: found.candidates });
    }
  }

  async function openTab(month: string, wb: XlsxWorkbook, tabName: string, source: Source) {
    const tab = readOpnameTab(await wb.sheet(tabName));
    if ("error" in tab) {
      say("bot", tab.error, "error");
      setStarted({ kind: "pilih-tab", month, source, wb, candidates: [] });
      return;
    }
    const lines = monthLines(allItems, transactions, month);
    const ctx: Ctx = {
      month,
      source,
      tab,
      lines,
      answered: {},
      replaceExisting: false,
      plan: buildPlan(lines, tab, padanan),
    };
    const col = colLetter(tab.ugdCol);
    const q = ctx.plan.questions.length;
    say(
      "bot",
      `File terbaca: tab "${tab.name}", kolom UGD = ${col}, barang di baris ${tab.firstRow}–${tab.lastRow}. ` +
        (lines.length === 0
          ? `Di aplikasi tidak ada barang dengan stok atau catatan di ${monthLabel(month)}.`
          : `Di aplikasi ada ${lines.length} barang dengan stok atau catatan di ${monthLabel(month)}: ` +
            `${ctx.plan.cells.length + ctx.plan.alreadyOk} langsung cocok` +
            (q ? `, ${q} perlu Anda pilih barisnya.` : ".")),
    );
    for (const w of tab.warnings) say("bot", w, "warn");
    if (q) setStarted({ kind: "tanya", ctx, questions: ctx.plan.questions, index: 0 });
    else setStarted({ kind: "pratinjau", ctx });
  }

  function answer(s: Extract<Stage, { kind: "tanya" }>, choice: Choice) {
    const q = s.questions[s.index];
    let answered = s.ctx.answered;
    if (choice === "nanti") {
      say("saya", "Tanya lagi lain kali");
    } else {
      const entries = answerEntries(q.line, choice, s.ctx.tab.rows, padananOf(q.line, { ...padanan, ...answered }));
      onSavePadanan(entries);
      answered = { ...answered, ...entries };
      say(
        "saya",
        "lewati" in choice
          ? "Lewati, tidak dicatat di stok opname"
          : `${choice.jumlahkan ? "Jumlahkan, isi ke " : ""}${rowLabel(choice.row)}`,
      );
    }
    const ctx = { ...s.ctx, answered };
    if (s.index + 1 < s.questions.length) {
      setStarted({ ...s, ctx, index: s.index + 1 });
    } else {
      const saved = s.questions.filter((x) => x.line.itemIds.some((id) => answered[id])).length;
      const later = s.questions.length - saved;
      say(
        "bot",
        saved === 0
          ? "Baik, barang-barang itu saya tanyakan lagi lain kali."
          : `Terima kasih, ${saved} jawaban sudah disimpan, jadi barang itu tidak saya tanyakan lagi.` +
              (later ? ` ${later} barang lainnya saya tanyakan lagi lain kali.` : ""),
      );
      setStarted({
        kind: "pratinjau",
        ctx: { ...ctx, plan: buildPlan(ctx.lines, ctx.tab, { ...padanan, ...answered }) },
      });
    }
  }

  function preparePaste(ctx: Ctx) {
    const written = cellsToWrite(ctx.plan, ctx.replaceExisting);
    say("saya", `Siapkan kolomnya (${written.length} sel)`);
    setStarted({ kind: "tempel", ctx, text: pasteText(ctx.tab, written), showText: false });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Kolom sudah disalin. Sekarang tempel di file stok opname.", "success");
    } catch {
      notify("Gagal menyalin otomatis. Tekan Tampilkan isi kolom, lalu salin manual.", "error");
    }
  }

  async function check(ctx: Ctx, data?: ArrayBuffer) {
    setStarted({ kind: "memuat", text: "Saya periksa file di Drive…" });
    try {
      const wb = await readXlsx(data ?? (await fromDrive()));
      const fresh = readOpnameTab(await wb.sheet(ctx.tab.name));
      if ("error" in fresh) throw new Error(fresh.error);
      const result = checkPaste(ctx.tab, cellsToWrite(ctx.plan, ctx.replaceExisting), fresh);
      const done = result.ok === result.total && result.diffs.length === 0;
      say(
        "bot",
        done
          ? `Semua ${result.total} sel sudah sesuai. Kolom UGD ${monthLabel(ctx.month)} selesai diisi.`
          : `${result.ok} dari ${result.total} sel sudah sesuai.`,
        done ? "ok" : "warn",
      );
      setStarted({ kind: "hasil", ctx, result });
    } catch (e) {
      say("bot", `Pemeriksaan gagal. ${e instanceof Error ? e.message : ""}`, "error");
      setStarted(
        ctx.source === "drive"
          ? {
              kind: "tempel",
              ctx,
              text: pasteText(ctx.tab, cellsToWrite(ctx.plan, ctx.replaceExisting)),
              showText: false,
            }
          : { kind: "unggah", month: ctx.month, ctx },
      );
    }
  }

  function restart() {
    setLog([]);
    setStarted({ kind: "bulan" });
  }

  return (
    <div className="chat" aria-live="polite">
      {log.map((b, i) => (
        <div key={i} className={`chat-msg ${b.from === "bot" ? "chat-bot" : "chat-me"}${b.tone ? ` ${b.tone}` : ""}`}>
          {b.from === "bot" && <div className="chat-who">Asisten</div>}
          {b.text}
        </div>
      ))}

      {stage === null && (
        <div className="chat-msg chat-bot">
          <div className="spinner" /> Membuka pengaturan…
        </div>
      )}
      {stage?.kind === "pengaturan" && (
        <SettingsStep
          meta={meta ?? null}
          fetchFile={fetchFile}
          onSave={(file, message) => {
            onSaveMeta(file);
            say("saya", "Simpan pengaturan file");
            say("bot", message.text, message.tone);
            setStarted({ kind: "bulan" });
          }}
          onCancel={meta ? () => setStarted({ kind: "bulan" }) : undefined}
        />
      )}
      {stage?.kind === "bulan" && (
        <MonthStep
          onChoose={chooseMonth}
          onSettings={() => setStarted({ kind: "pengaturan" })}
          hasKey={!!meta?.driveKey}
        />
      )}
      {stage?.kind === "memuat" && (
        <div className="chat-msg chat-bot chat-current">
          <div className="chat-who">Asisten</div>
          <span className="chat-loading">
            <span className="spinner" /> {stage.text}
          </span>
        </div>
      )}
      {stage?.kind === "unggah" && (
        <UploadStep
          checking={!!stage.ctx}
          onFile={(data) => {
            say("saya", "Unggah file .xlsx");
            if (stage.ctx) void check(stage.ctx, data);
            else void openWorkbook(stage.month, data, "unggah");
          }}
          onBack={() => setStarted({ kind: "bulan" })}
        />
      )}
      {stage?.kind === "pilih-tab" && (
        <div className="chat-msg chat-bot chat-current">
          <div className="chat-who">Asisten</div>
          Pilih tab untuk {monthLabel(stage.month)}:
          <div className="chat-options">
            {(stage.candidates.length ? stage.candidates : stage.wb.sheetNames).map((name) => (
              <button
                key={name}
                className="btn btn-ghost"
                onClick={() => {
                  say("saya", `Tab "${name}"`);
                  void openTab(stage.month, stage.wb, name, stage.source);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          {stage.candidates.length > 0 && (
            <button className="btn btn-link chat-more" onClick={() => setStarted({ ...stage, candidates: [] })}>
              Tampilkan semua tab
            </button>
          )}
        </div>
      )}
      {stage?.kind === "tanya" && <QuestionStep key={stage.index} stage={stage} onAnswer={(c) => answer(stage, c)} />}
      {stage?.kind === "pratinjau" && (
        <PreviewStep
          ctx={stage.ctx}
          onToggleReplace={(v) => setStarted({ kind: "pratinjau", ctx: { ...stage.ctx, replaceExisting: v } })}
          onPrepare={() => preparePaste(stage.ctx)}
          onRestart={restart}
        />
      )}
      {stage?.kind === "tempel" && meta && (
        <PasteStep
          stage={stage}
          link={sheetUrl(meta.fileId)}
          onCopy={() => copy(stage.text)}
          onToggleText={() => setStarted({ ...stage, showText: !stage.showText })}
          onCheck={() => {
            say("saya", "Sudah saya tempel");
            if (stage.ctx.source === "drive") void check(stage.ctx);
            else {
              say(
                "bot",
                "Unduh lagi file yang sudah ditempel (File → Download → Microsoft Excel), lalu unggah di sini supaya bisa saya periksa.",
              );
              setStarted({ kind: "unggah", month: stage.ctx.month, ctx: stage.ctx });
            }
          }}
        />
      )}
      {stage?.kind === "hasil" && (
        <ResultStep
          ctx={stage.ctx}
          result={stage.result}
          onAgain={() => {
            say("saya", "Periksa lagi");
            if (stage.ctx.source === "drive") void check(stage.ctx);
            else setStarted({ kind: "unggah", month: stage.ctx.month, ctx: stage.ctx });
          }}
          onBackToPaste={() =>
            setStarted({
              kind: "tempel",
              ctx: stage.ctx,
              text: pasteText(stage.ctx.tab, cellsToWrite(stage.ctx.plan, stage.ctx.replaceExisting)),
              showText: false,
            })
          }
          onRestart={restart}
        />
      )}
      <div ref={endRef} />
    </div>
  );
}

// ---------- langkah-langkah ----------

function SettingsStep({
  meta,
  fetchFile,
  onSave,
  onCancel,
}: {
  meta: StokOpnameMeta | null;
  fetchFile: (fileId: string, driveKey: string) => Promise<ArrayBuffer>;
  onSave: (file: FileSettings, message: { text: string; tone: Bubble["tone"] }) => void;
  onCancel?: () => void;
}) {
  const [link, setLink] = useState(meta?.link ?? "");
  const [key, setKey] = useState(meta?.driveKey ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const fileId = driveFileId(link);
    if (!fileId) {
      setError(
        "Itu bukan link Google Drive atau Google Spreadsheet. Salin link dari tombol Bagikan atau dari bilah alamat.",
      );
      return;
    }
    const file = { fileId, link: link.trim(), driveKey: key.trim() };
    if (!file.driveKey) {
      onSave(file, {
        text: "Pengaturan disimpan. Tanpa kunci Drive API, file perlu diunggah setiap kali. Kunci bisa ditambahkan nanti lewat tombol Pengaturan file.",
        tone: undefined,
      });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const wb = await readXlsx(await fetchFile(file.fileId, file.driveKey));
      onSave(file, { text: `Kunci berfungsi: file terbaca, berisi ${wb.sheetNames.length} tab.`, tone: "ok" });
    } catch (e) {
      onSave(file, {
        text: `Pengaturan disimpan, tapi file belum bisa diambil otomatis. ${e instanceof Error ? e.message : ""} Untuk sementara, file bisa diunggah.`,
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-msg chat-bot chat-current">
      <div className="chat-who">Asisten</div>
      <p>
        Halo! Saya membantu mengisi kolom <b>UGD</b> di file stok opname puskesmas dari stok akhir bulan di aplikasi.
        Pertama, tempel link file stok opname-nya.
      </p>
      <div className="form-group chat-field">
        <label className="form-label" htmlFor="asisten-link">
          Link file stok opname
        </label>
        <input
          id="asisten-link"
          className="form-input"
          value={link}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          onChange={(e) => setLink(e.target.value)}
        />
      </div>
      <div className="form-group chat-field">
        <label className="form-label" htmlFor="asisten-key">
          Kunci Drive API <span className="text-faint">(tidak wajib)</span>
        </label>
        <input
          id="asisten-key"
          className="form-input mono"
          value={key}
          placeholder="AIza…"
          autoComplete="off"
          onChange={(e) => setKey(e.target.value)}
        />
        <p className="form-hint">
          Dengan kunci ini, saya bisa mengambil file dari Drive sendiri. Tanpa kunci, file perlu diunduh lalu diunggah
          setiap bulan. Kunci disimpan di database aplikasi dan hanya bisa dilihat admin.
        </p>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="chat-actions">
        <button className="btn btn-primary" disabled={busy || !link.trim()} onClick={() => void save()}>
          {busy ? <span className="spinner" /> : <Icon type="check" size={18} />} Simpan
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>
            Batal
          </button>
        )}
      </div>
    </div>
  );
}

function MonthStep({
  onChoose,
  onSettings,
  hasKey,
}: {
  onChoose: (month: string) => void;
  onSettings: () => void;
  hasKey: boolean;
}) {
  const thisMonth = todayStr().slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const [other, setOther] = useState(lastMonth);
  return (
    <div className="chat-msg chat-bot chat-current">
      <div className="chat-who">Asisten</div>
      Kolom UGD untuk bulan apa yang mau diisi?
      <div className="chat-options">
        <button className="btn btn-primary" onClick={() => onChoose(lastMonth)}>
          {monthLabel(lastMonth)} <span className="chat-hint">(bulan lalu)</span>
        </button>
        <button className="btn btn-ghost" onClick={() => onChoose(thisMonth)}>
          {monthLabel(thisMonth)} <span className="chat-hint">(bulan ini, sampai hari ini)</span>
        </button>
      </div>
      <div className="chat-actions">
        <input
          className="form-input chat-month"
          type="month"
          aria-label="Bulan lain"
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
        <button className="btn btn-ghost" disabled={!other} onClick={() => onChoose(other)}>
          Pilih bulan ini
        </button>
      </div>
      <p className="form-hint">
        {hasKey
          ? "File stok opname diambil langsung dari Drive."
          : "File stok opname perlu diunggah (kunci Drive API belum diatur)."}{" "}
        <button className="btn-link" onClick={onSettings}>
          Pengaturan file
        </button>
      </p>
    </div>
  );
}

function UploadStep({
  checking,
  onFile,
  onBack,
}: {
  checking: boolean;
  onFile: (data: ArrayBuffer) => void;
  onBack: () => void;
}) {
  return (
    <div className="chat-msg chat-bot chat-current">
      <div className="chat-who">Asisten</div>
      {checking ? "Unggah file yang sudah ditempel:" : "Unggah file stok opname:"}
      <ol className="chat-list">
        <li>Buka file stok opname di Google Spreadsheet.</li>
        <li>
          Pilih <b>File → Download → Microsoft Excel (.xlsx)</b>.
        </li>
        <li>Pilih file yang baru diunduh itu di sini.</li>
      </ol>
      <div className="chat-actions">
        <label className="btn btn-primary">
          <Icon type="download" size={18} /> Pilih file .xlsx
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(await f.arrayBuffer());
            }}
          />
        </label>
        <button className="btn btn-ghost" onClick={onBack}>
          Kembali
        </button>
      </div>
    </div>
  );
}

function QuestionStep({
  stage,
  onAnswer,
}: {
  stage: Extract<Stage, { kind: "tanya" }>;
  onAnswer: (choice: Choice) => void;
}) {
  const q = stage.questions[stage.index];
  const [query, setQuery] = useState("");
  const found = useMemo(
    () => searchRows(query, stage.ctx.tab.rows).filter((r) => !q.rows.includes(r)),
    [query, stage.ctx.tab.rows, q.rows],
  );
  const unit = q.line.unit ? ` (${q.line.unit})` : "";
  return (
    <div className="chat-msg chat-bot chat-current">
      <div className="chat-who">
        Asisten · pertanyaan {stage.index + 1} dari {stage.questions.length}
      </div>
      <p>
        <b>{q.line.name}</b>
        {unit}, stok {fmt(q.line.stock)}
      </p>
      {q.kind === "satuan-beda" ? (
        <>
          <p>
            Di aplikasi, barang ini tercatat dengan satuan berbeda ({q.line.unit}). Boleh dijumlahkan jadi{" "}
            {fmt(q.line.stock)}?
          </p>
          <div className="chat-options">
            <button className="btn btn-primary" onClick={() => onAnswer({ row: q.rows[0], jumlahkan: true })}>
              Ya, jumlahkan ke {rowLabel(q.rows[0])}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{REASON[q.kind] ?? "Pilih barisnya:"}</p>
          <div className="chat-options">
            {q.rows.map((r) => (
              <button key={r.row} className="btn btn-ghost" onClick={() => onAnswer({ row: r })}>
                {rowLabel(r)}
              </button>
            ))}
          </div>
          <div className="chat-search">
            <input
              className="form-input"
              placeholder="Cari baris lain di file, mis. sekali pakai 1 ml"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {found.length > 0 && (
              <div className="chat-options">
                {found.map((r) => (
                  <button key={r.row} className="btn btn-ghost" onClick={() => onAnswer({ row: r })}>
                    {rowLabel(r)}
                  </button>
                ))}
              </div>
            )}
            {query.trim() && found.length === 0 && <p className="form-hint">Tidak ada baris dengan kata itu.</p>}
          </div>
        </>
      )}
      <div className="chat-actions">
        <button className="btn btn-ghost" onClick={() => onAnswer({ lewati: true })}>
          Lewati: tidak dicatat di stok opname
        </button>
        <button className="btn btn-ghost" onClick={() => onAnswer("nanti")}>
          Tanya lagi lain kali
        </button>
      </div>
    </div>
  );
}

function PreviewStep({
  ctx,
  onToggleReplace,
  onPrepare,
  onRestart,
}: {
  ctx: Ctx;
  onToggleReplace: (value: boolean) => void;
  onPrepare: () => void;
  onRestart: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const col = colLetter(ctx.tab.ugdCol);
  const { plan } = ctx;
  const fill = plan.cells.filter((c) => c.action === "isi");
  const conflicts = plan.cells.filter((c) => c.action !== "isi");
  const written = cellsToWrite(plan, ctx.replaceExisting);
  return (
    <div className="chat-msg chat-bot chat-current">
      <div className="chat-who">Asisten · pratinjau</div>
      <p>
        Rencana untuk tab <b>{ctx.tab.name}</b>, kolom <b>{col}</b>:
      </p>
      <ul className="chat-list">
        <li>
          <b>{fill.length}</b> sel kosong akan diisi
        </li>
        {plan.alreadyOk > 0 && <li>{plan.alreadyOk} sel sudah berisi angka yang sama</li>}
        {plan.questions.length > 0 && <li>{plan.questions.length} barang belum dijawab, jadi tidak diisi kali ini</li>}
        {plan.skipped.length > 0 && <li>{plan.skipped.length} barang dilewati (tidak dicatat di stok opname)</li>}
      </ul>
      {conflicts.length > 0 && (
        <div className="chat-box warn">
          <b>{conflicts.length} sel sudah berisi angka lain:</b>
          <ul className="chat-list">
            {conflicts.map((c) => (
              <li key={c.row.row}>
                <span className="chat-ref">
                  {col}
                  {c.row.row}
                </span>{" "}
                {c.row.name}: {show(c.row.ugd)} → {c.value === null ? "kosong" : fmt(c.value)}
              </li>
            ))}
          </ul>
          <label className="chat-check">
            <input type="checkbox" checked={ctx.replaceExisting} onChange={(e) => onToggleReplace(e.target.checked)} />
            Ganti juga dengan angka dari aplikasi
          </label>
        </div>
      )}
      {plan.leftovers.length > 0 && (
        <div className="chat-box">
          {plan.leftovers.length} sel UGD sudah berisi, tapi barangnya tidak ada di aplikasi bulan ini (tidak diubah):
          <ul className="chat-list">
            {plan.leftovers.slice(0, 8).map((r) => (
              <li key={r.row}>
                <span className="chat-ref">
                  {col}
                  {r.row}
                </span>{" "}
                {r.name}: {show(r.ugd)}
                {isTableHeader(r.ugd) && " (judul tabel Excel yang melebar, bukan angka stok)"}
              </li>
            ))}
          </ul>
        </div>
      )}
      {fill.length > 0 && (
        <>
          <button className="btn-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Sembunyikan daftar" : `Lihat ${fill.length} sel yang akan diisi`}
          </button>
          {showAll && (
            <ul className="chat-list">
              {fill.map((c) => (
                <li key={c.row.row}>
                  <span className="chat-ref">
                    {col}
                    {c.row.row}
                  </span>{" "}
                  {c.row.name} → <b>{c.value === null ? "kosong" : fmt(c.value)}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="chat-actions">
        <button className="btn btn-primary" disabled={written.length === 0} onClick={onPrepare}>
          Siapkan kolom untuk ditempel
        </button>
        <button className="btn btn-ghost" onClick={onRestart}>
          Mulai lagi
        </button>
      </div>
      {written.length === 0 && <p className="form-hint">Tidak ada sel yang perlu diubah.</p>}
    </div>
  );
}

function PasteStep({
  stage,
  link,
  onCopy,
  onToggleText,
  onCheck,
}: {
  stage: Extract<Stage, { kind: "tempel" }>;
  link: string;
  onCopy: () => void;
  onToggleText: () => void;
  onCheck: () => void;
}) {
  const { tab } = stage.ctx;
  const ref = `${colLetter(tab.ugdCol)}${tab.firstRow}`;
  return (
    <div className="chat-msg chat-bot chat-current">
      <div className="chat-who">Asisten · tempel</div>
      <p>Kolomnya sudah siap. Langkah ini sebaiknya dilakukan di komputer:</p>
      <ol className="chat-list">
        <li>
          Tekan <b>Salin kolom</b>.
        </li>
        <li>
          Tekan <b>Buka file stok opname</b>, lalu pilih tab <b>{tab.name}</b> di bagian bawah.
        </li>
        <li>
          Klik sel <span className="chat-ref chat-big">{ref}</span> (kolom UGD, baris "{tab.rows[0].name}"). Atau ketik{" "}
          <b>{ref}</b> di kotak nama sel di kiri atas, lalu tekan Enter.
        </li>
        <li>
          Tempel: <b>Ctrl+V</b> (Windows) atau <b>⌘+V</b> (Mac).
        </li>
        <li>
          Tunggu sampai tertulis <b>Disimpan ke Drive</b>, lalu kembali ke sini dan tekan <b>Sudah saya tempel</b>.
        </li>
      </ol>
      {tab.warnings.length > 0 && (
        <div className="chat-box warn">
          {tab.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      <div className="chat-actions">
        <button className="btn btn-primary" onClick={onCopy}>
          <Icon type="check" size={18} /> Salin kolom
        </button>
        <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">
          Buka file stok opname
        </a>
        <button className="btn btn-primary" onClick={onCheck}>
          Sudah saya tempel
        </button>
      </div>
      <button className="btn-link" onClick={onToggleText}>
        {stage.showText ? "Sembunyikan isi kolom" : "Tampilkan isi kolom (untuk disalin manual)"}
      </button>
      {stage.showText && (
        <textarea className="form-input csv-preview" readOnly value={stage.text} aria-label="Isi kolom UGD" />
      )}
    </div>
  );
}

function ResultStep({
  ctx,
  result,
  onAgain,
  onBackToPaste,
  onRestart,
}: {
  ctx: Ctx;
  result: CheckResult;
  onAgain: () => void;
  onBackToPaste: () => void;
  onRestart: () => void;
}) {
  const col = colLetter(ctx.tab.ugdCol);
  const done = result.ok === result.total && result.diffs.length === 0;
  const notYet =
    result.diffs.length > 0 && result.diffs.every((d) => d.planned && (d.actual === null || d.actual === ""));
  return (
    <div className={`chat-msg chat-bot chat-current${done ? " ok" : ""}`}>
      <div className="chat-who">Asisten · hasil pemeriksaan</div>
      {done ? (
        <p>
          <Icon type="check" size={18} /> Selesai. Semua {result.total} sel di kolom {col} tab "{ctx.tab.name}" sudah
          sesuai dengan aplikasi.
        </p>
      ) : (
        <>
          {notYet && (
            <p>
              Sel-selnya masih kosong di Drive. Drive biasanya butuh sekitar 1 menit untuk menyimpan tempelan. Tunggu
              sebentar, lalu periksa lagi.
            </p>
          )}
          <ul className="chat-list">
            {result.diffs.slice(0, 12).map((d, i) => (
              <li key={i}>
                {d.row === null ? (
                  <>"{d.name}": barisnya tidak ditemukan lagi di file.</>
                ) : (
                  <>
                    <span className="chat-ref">
                      {col}
                      {d.row}
                    </span>{" "}
                    {d.name}: seharusnya {show(d.expected)}, di file {show(d.actual)}
                    {!d.planned && " (sel ini tidak ikut diisi; mungkin tempelan bergeser)"}
                  </>
                )}
              </li>
            ))}
          </ul>
          {result.diffs.length > 12 && <p className="form-hint">…dan {result.diffs.length - 12} lainnya.</p>}
        </>
      )}
      {result.texts.length > 0 && (
        <div className="chat-box warn">
          Ada teks (bukan angka) di kolom UGD: {result.texts.map((r) => `${col}${r.row} "${String(r.ugd)}"`).join(", ")}
          . Biasanya ini judul tabel Excel yang melebar; minta pengelola file mengubah tabel itu jadi rentang biasa.
        </div>
      )}
      <div className="chat-actions">
        {!done && (
          <>
            <button className="btn btn-primary" onClick={onAgain}>
              Periksa lagi
            </button>
            <button className="btn btn-ghost" onClick={onBackToPaste}>
              Kembali ke langkah menempel
            </button>
          </>
        )}
        <button className={`btn ${done ? "btn-primary" : "btn-ghost"}`} onClick={onRestart}>
          {done ? "Isi bulan lain" : "Mulai lagi"}
        </button>
      </div>
    </div>
  );
}

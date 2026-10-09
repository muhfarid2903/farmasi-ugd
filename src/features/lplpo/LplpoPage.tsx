import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { ShowMoreButton } from "../../components/ShowMore";
import { useShowMore } from "../../hooks/useShowMore";
import { monthLabel, shiftMonth, todayStr } from "../../lib/date";
import {
  DEFAULT_SIGNERS,
  isPrinted,
  lplpoPeriode,
  lplpoRows,
  permintaanValue,
  printedSigners,
  totalKunjungan,
  type Signer,
} from "../../lib/lplpo";
import { parseCount } from "../../lib/opname";
import { subscribeLplpoMeta, type LplpoMeta } from "../../lib/repository";
import { matchScore } from "../../lib/search";
import type { Item, Transaction } from "../../types";
import { AddItemModal } from "./AddItemModal";
import { LplpoSheet } from "./LplpoSheet";
import { SignersModal } from "./SignersModal";

/** Isian petugas untuk satu bulan; disimpan di HP supaya tidak hilang bila aplikasi tertutup. */
interface Draft {
  /** itemId → isian permintaan (bisa belum valid). Barang yang tidak diubah memakai usulan. */
  permintaan: Record<string, string>;
  /** Barang yang ditambahkan petugas. */
  tambahan: string[];
  umum: string;
  bpjs: string;
}

const EMPTY_DRAFT: Draft = { permintaan: {}, tambahan: [], umum: "", bpjs: "" };
const draftKey = (month: string) => `ugd.lplpo.${month}`;

function loadDraft(month: string): Draft {
  try {
    return { ...EMPTY_DRAFT, ...(JSON.parse(localStorage.getItem(draftKey(month)) ?? "{}") as Partial<Draft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraft(month: string, draft: Draft) {
  try {
    const empty =
      Object.keys(draft.permintaan).length === 0 && draft.tambahan.length === 0 && !draft.umum && !draft.bpjs;
    if (empty) localStorage.removeItem(draftKey(month));
    else localStorage.setItem(draftKey(month), JSON.stringify(draft));
  } catch {
    // penyimpanan tidak tersedia: isian hanya bertahan selama halaman terbuka
  }
}

interface LplpoPageProps {
  /** Barang aktif (untuk ditambahkan). */
  items: Item[];
  /** Termasuk barang yang sudah digabung (untuk hitungan). */
  allItems: Item[];
  transactions: Transaction[];
  isAdmin: boolean;
  onSaveSigners: (signers: Signer[]) => void;
  onBack: () => void;
}

/** LPLPO dari UGD ke farmasi puskesmas: angka diisi otomatis, permintaan bisa diubah, lalu dicetak. */
export function LplpoPage({ items, allItems, transactions, isAdmin, onSaveSigners, onBack }: LplpoPageProps) {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(() => shiftMonth(thisMonth, -1));
  const [draft, setDraft] = useState<Draft>(() => loadDraft(shiftMonth(thisMonth, -1)));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"tambah" | "ttd" | null>(null);
  const [meta, setMeta] = useState<LplpoMeta | null>(null);

  useEffect(() => subscribeLplpoMeta(setMeta), []);
  useEffect(() => saveDraft(month, draft), [month, draft]);

  // Lembar cetak hanya berlaku selama halaman ini terbuka; judul jadi nama file saat disimpan sebagai PDF
  useEffect(() => {
    document.body.classList.add("print-lplpo");
    return () => document.body.classList.remove("print-lplpo");
  }, []);
  useEffect(() => {
    const prev = document.title;
    document.title = `LPLPO UGD ${monthLabel(month)}`;
    return () => {
      document.title = prev;
    };
  }, [month]);

  const allRows = useMemo(
    () => lplpoRows(allItems, transactions, month, today),
    [allItems, transactions, month, today],
  );
  const added = useMemo(() => new Set(draft.tambahan), [draft.tambahan]);
  const rows = useMemo(() => allRows.filter((r) => isPrinted(r, added)), [allRows, added]);
  const values = useMemo(
    () => new Map(rows.map((r) => [r.itemId, permintaanValue(r, draft.permintaan[r.itemId])])),
    [rows, draft.permintaan],
  );
  const invalidRow = rows.find((r) => values.get(r.itemId) === null);
  const requested = [...values.values()].filter((v) => v !== null && v > 0).length;
  // Di layar, barang yang baru ditambahkan tampil paling atas supaya langsung terlihat; cetakan tetap urut jenis
  const screenRows = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.itemId, r]));
    const top = [...draft.tambahan].reverse().flatMap((id) => byId.get(id) ?? []);
    return [...top, ...rows.filter((r) => !added.has(r.itemId))];
  }, [rows, draft.tambahan, added]);
  const shown = useMemo(
    () => (search.trim() ? screenRows.filter((r) => matchScore(search, r.name) > 0) : screenRows),
    [screenRows, search],
  );
  const { visible, rest, more, reset } = useShowMore(shown, 40);
  useEffect(reset, [search, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const notListed = useMemo(() => {
    const listed = new Set(rows.map((r) => r.itemId));
    return items.filter((i) => !listed.has(i.id));
  }, [items, rows]);
  const recorded = useMemo(
    () => transactions.some((t) => t.date.startsWith(month) && !t.adjust),
    [transactions, month],
  );

  const umum = parseCount(draft.umum);
  const bpjs = parseCount(draft.bpjs);
  const kunjunganInvalid = (draft.umum.trim() !== "" && umum === null) || (draft.bpjs.trim() !== "" && bpjs === null);
  const signers = meta?.signers ?? DEFAULT_SIGNERS;
  const periode = lplpoPeriode(month);

  function changeMonth(m: string) {
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    setMonth(m);
    setDraft(loadDraft(m));
  }

  const setPermintaan = (itemId: string, value: string | undefined) =>
    setDraft((d) => {
      const permintaan = { ...d.permintaan };
      if (value === undefined) delete permintaan[itemId];
      else permintaan[itemId] = value;
      return { ...d, permintaan };
    });

  function removeAdded(itemId: string) {
    setDraft((d) => {
      const permintaan = { ...d.permintaan };
      delete permintaan[itemId];
      return { ...d, permintaan, tambahan: d.tambahan.filter((id) => id !== itemId) };
    });
  }

  function resetPermintaan() {
    if (window.confirm("Kembalikan semua angka permintaan ke usulan aplikasi?")) {
      setDraft((d) => ({ ...d, permintaan: {} }));
    }
  }

  const blocked =
    rows.length === 0
      ? "Belum ada barang untuk dicetak."
      : invalidRow
        ? `Angka permintaan ${invalidRow.name} belum benar.`
        : kunjunganInvalid
          ? "Angka jumlah kunjungan belum benar."
          : null;

  return (
    <>
      <button className="btn-link" onClick={onBack}>
        ← Kembali
      </button>
      <h1 className="page-title">LPLPO</h1>
      <p className="page-sub">
        Laporan Pemakaian dan Lembar Permintaan Obat untuk <b>farmasi puskesmas</b>. Angka diisi dari catatan barang
        masuk dan keluar. Periksa angka permintaan, lalu cetak.
      </p>

      <h2 className="section-title">1. Bulan pemakaian</h2>
      <div className="form-group lplpo-month">
        <label className="form-label" htmlFor="lplpo-month">
          Bulan yang dilaporkan
        </label>
        <input
          id="lplpo-month"
          className="form-input"
          type="month"
          max={thisMonth}
          value={month}
          onChange={(e) => changeMonth(e.target.value)}
        />
        <p className="form-hint">
          Dicetak sebagai laporan bulan pemakaian <b>{monthLabel(month)}</b>, bulan pelaporan{" "}
          <b>{monthLabel(shiftMonth(month, 1))}</b>.
        </p>
      </div>
      {month === thisMonth && (
        <div className="merge-warn">
          <Icon type="alert" size={20} /> Bulan ini belum selesai. Angkanya masih bisa bertambah sampai akhir bulan.
        </div>
      )}
      {!recorded && (
        <div className="merge-warn">
          <Icon type="alert" size={20} /> Belum ada catatan barang masuk atau keluar di bulan ini, jadi penerimaan dan
          pemakaian semuanya 0.
        </div>
      )}

      <h2 className="section-title">2. Periksa permintaan</h2>
      <p className="form-hint lplpo-hint">
        Usulan aplikasi = pemakaian + stok minimum − sisa stok. Ubah angkanya bila perlu. Kolom Pemberian dikosongkan
        untuk diisi farmasi.
      </p>
      {rows.length > 8 && (
        <div className="search-box search-box-page">
          <Icon type="search" size={20} />
          <input
            type="search"
            placeholder="Cari barang di daftar..."
            aria-label="Cari barang di daftar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      <p className="list-label">
        {rows.length} barang tercetak · {requested} diminta
      </p>
      <div className="card-list">
        {visible.map((r) => {
          const raw = draft.permintaan[r.itemId];
          const value = values.get(r.itemId);
          const changed = raw !== undefined && value !== r.usulan;
          return (
            <div key={r.itemId} className={`opname-row${changed ? " diff" : ""}`}>
              <div className="stock-card-main">
                <div className="stock-card-name">{r.name}</div>
                <div className="stock-card-meta">
                  Stok awal <b>{r.stokAwal}</b> · Penerimaan <b>{r.penerimaan}</b> · Pemakaian <b>{r.pemakaian}</b> ·
                  Sisa <b>{r.sisa}</b> {r.unit}
                </div>
                {r.ket && <div className="stock-card-meta">Ket: {r.ket}</div>}
                {value === null && <div className="lplpo-error">Isi angka bulat, paling sedikit 0</div>}
                {changed && (
                  <button className="btn-link" onClick={() => setPermintaan(r.itemId, undefined)}>
                    Pakai usulan ({r.usulan})
                  </button>
                )}
                {added.has(r.itemId) && (
                  <button className="btn-link" onClick={() => removeAdded(r.itemId)}>
                    Hapus dari daftar
                  </button>
                )}
              </div>
              <div className="opname-input">
                <label className="form-hint" htmlFor={`lp-${r.itemId}`}>
                  Permintaan
                </label>
                <input
                  id={`lp-${r.itemId}`}
                  className="form-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={raw ?? String(r.usulan)}
                  onChange={(e) => setPermintaan(r.itemId, e.target.value)}
                />
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-faint">Tidak ada barang yang cocok.</p>}
      </div>
      <ShowMoreButton rest={rest} onClick={more} />
      <button className="btn btn-ghost lplpo-add" onClick={() => setModal("tambah")}>
        <Icon type="plus" size={18} /> Tambah barang lain
      </button>

      <h2 className="section-title">3. Jumlah kunjungan</h2>
      <p className="form-hint lplpo-hint">Jumlah pasien UGD bulan itu. Boleh dikosongkan untuk ditulis tangan.</p>
      <div className="form-row lplpo-kunjungan-input">
        {(["umum", "bpjs"] as const).map((key) => (
          <div key={key} className="form-group">
            <label className="form-label" htmlFor={`lplpo-${key}`}>
              {key === "umum" ? "Umum" : "BPJS"}
            </label>
            <input
              id={`lplpo-${key}`}
              className="form-input"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="—"
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {kunjunganInvalid ? (
        <div className="lplpo-error">Isi angka bulat, paling sedikit 0</div>
      ) : (
        totalKunjungan(umum, bpjs) !== null && (
          <p className="list-label">Total kunjungan: {totalKunjungan(umum, bpjs)}</p>
        )
      )}

      <h2 className="section-title">Penanda tangan</h2>
      <div className="settings-card lplpo-signers">
        {printedSigners(signers).map((s, i) => (
          <div key={i} className="review-line">
            <span>
              {s.role} {s.title}
            </span>
            <span>{s.name ? `${s.name}${s.nip ? ` (NIP ${s.nip})` : ""}` : "ditulis tangan"}</span>
          </div>
        ))}
        {isAdmin ? (
          <div className="settings-card-actions">
            <button className="btn btn-ghost" onClick={() => setModal("ttd")}>
              <Icon type="edit" size={18} /> Ubah penanda tangan
            </button>
          </div>
        ) : (
          <p className="form-hint">Penanda tangan diatur oleh admin.</p>
        )}
      </div>

      <div className="opname-bar">
        <div>
          <b>{rows.length}</b> barang · <b>{requested}</b> diminta
          {blocked && <div className="lplpo-error">{blocked}</div>}
        </div>
        <div className="opname-bar-actions">
          {Object.keys(draft.permintaan).length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={resetPermintaan}>
              Kembalikan ke usulan
            </button>
          )}
          <button className="btn btn-primary" disabled={!!blocked} onClick={() => window.print()}>
            <Icon type="printer" size={18} /> Cetak LPLPO
          </button>
        </div>
      </div>
      <p className="form-hint lplpo-print-help">
        Setelah menekan <b>Cetak LPLPO</b>: pilih printer, atau <b>Simpan sebagai PDF</b> lalu kirim lewat WhatsApp.
        Bila kertas belum mendatar, pilih tata letak <b>Lanskap</b>.
      </p>

      <LplpoSheet
        periode={periode}
        rows={rows.map((row) => ({ row, permintaan: values.get(row.itemId) ?? 0 }))}
        signers={printedSigners(signers)}
        kunjungan={{ umum, bpjs, total: totalKunjungan(umum, bpjs) }}
        dibuat={new Date(`${today}T00:00:00`).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      {modal === "tambah" && (
        <AddItemModal
          items={notListed}
          onAdd={(id) => setDraft((d) => ({ ...d, tambahan: [...d.tambahan, id] }))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "ttd" && (
        <SignersModal
          signers={signers}
          onSave={(s) => {
            onSaveSigners(s);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

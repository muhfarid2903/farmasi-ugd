import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { buildItemRecapCSV, buildRecapCSV, downloadText } from "../../lib/csv";
import { monthLabel, todayStr } from "../../lib/date";
import { activeRows, monthlyRecap } from "../../lib/recap";
import { filterByPeriod } from "../../lib/stock";
import type { Item, Transaction } from "../../types";

interface ExportModalProps {
  items: Item[];
  transactions: Transaction[];
  onClose: () => void;
  notify: (text: string, kind: "success" | "error") => void;
}

export function ExportModal({ items, transactions, onClose, notify }: ExportModalProps) {
  /** catatan = daftar transaksi; rekap = per barang (stok awal, masuk, keluar, akhir) per bulan. */
  const [kind, setKind] = useState<"catatan" | "rekap">("catatan");
  const [mode, setMode] = useState<"bulan" | "rentang">("bulan");
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");

  const filtered = useMemo(
    () => filterByPeriod(transactions, mode === "bulan" ? { mode, month } : { mode, from, to }),
    [transactions, mode, month, from, to],
  );
  const masukCount = filtered.filter((t) => t.type === "masuk").length;
  const recapRows = useMemo(
    () => (kind === "rekap" ? activeRows(monthlyRecap(items, transactions, month)) : []),
    [kind, items, transactions, month],
  );

  function handleDownload() {
    if (kind === "rekap") {
      const name = `rekap_stok_per_barang_${monthLabel(month).replace(" ", "_")}.csv`;
      const content = buildItemRecapCSV(recapRows, monthLabel(month));
      setCsv(content);
      setFilename(name);
      try {
        downloadText(content, name);
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (filtered.length === 0) return notify("Tidak ada catatan pada waktu yang dipilih.", "error");
    const label = mode === "bulan" ? monthLabel(month) : `${from} s/d ${to}`;
    const name =
      mode === "bulan" ? `rekap_ugd_${monthLabel(month).replace(" ", "_")}.csv` : `rekap_ugd_${from}_sd_${to}.csv`;
    const content = buildRecapCSV(filtered, label);
    setCsv(content);
    setFilename(name);
    try {
      downloadText(content, name);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(csv);
      notify("Data berhasil disalin ke clipboard!", "success");
    } catch {
      notify("Gagal menyalin. Pilih teks lalu salin secara manual.", "error");
    }
  }

  return (
    <Modal title="Unduh Laporan" onClose={onClose}>
      {!csv ? (
        <>
          <div className="form-group">
            <label className="form-label">Jenis laporan</label>
            <div className="btn-group">
              <button
                className={`btn ${kind === "catatan" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setKind("catatan")}
              >
                Daftar catatan
              </button>
              <button
                className={`btn ${kind === "rekap" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setKind("rekap")}
              >
                Rekap per barang
              </button>
            </div>
            <p className="form-hint">
              {kind === "catatan"
                ? "Semua catatan barang masuk dan keluar satu per satu."
                : "Satu baris per barang: stok awal, masuk, keluar, penyesuaian, dan stok akhir bulan."}
            </p>
          </div>
          {kind === "catatan" && (
            <div className="form-group">
              <label className="form-label">Laporan untuk</label>
              <div className="btn-group">
                <button
                  className={`btn ${mode === "bulan" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMode("bulan")}
                >
                  Satu bulan
                </button>
                <button
                  className={`btn ${mode === "rentang" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMode("rentang")}
                >
                  Pilih tanggal
                </button>
              </div>
            </div>
          )}
          {mode === "bulan" || kind === "rekap" ? (
            <div className="form-group">
              <label className="form-label" htmlFor="exp-month">
                Bulan
              </label>
              <input
                id="exp-month"
                className="form-input"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="exp-from">
                  Dari Tanggal
                </label>
                <input
                  id="exp-from"
                  className="form-input"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="exp-to">
                  Sampai Tanggal
                </label>
                <input
                  id="exp-to"
                  className="form-input"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="export-preview">
            <div className="export-preview-label">Isi laporan:</div>
            <div className="export-preview-count">
              {kind === "rekap" ? (
                <>
                  <span className="export-preview-number">{recapRows.length}</span> barang (yang punya stok atau
                  pergerakan bulan ini)
                </>
              ) : filtered.length === 0 ? (
                <span className="text-faint">Tidak ada catatan pada waktu ini</span>
              ) : (
                <>
                  <span className="export-preview-number">{filtered.length}</span> catatan{" "}
                  <span className="tag tag-masuk">↓ {masukCount} masuk</span>{" "}
                  <span className="tag tag-keluar">↑ {filtered.length - masukCount} keluar</span>
                </>
              )}
            </div>
          </div>
          <div className="modal-actions spaced">
            <button className="btn btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleDownload}>
              <Icon type="download" size={18} /> Unduh File Excel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="info-banner green">
            <Icon type="check" size={16} /> Laporan sudah dibuat dan diunduh. Buka file-nya dengan Excel. Kalau file
            tidak muncul, salin isi di bawah lalu tempel ke Excel.
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-csv">
              Nama File: {filename}
            </label>
            <textarea id="exp-csv" className="form-input csv-preview" readOnly value={csv} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setCsv("")}>
              ← Kembali
            </button>
            <button className="btn btn-primary" onClick={handleCopy}>
              <Icon type="check" size={16} /> Salin ke Clipboard
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

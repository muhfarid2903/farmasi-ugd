import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { buildRecapCSV, downloadText } from "../../lib/csv";
import { monthLabel, todayStr } from "../../lib/date";
import { filterByPeriod } from "../../lib/stock";
import type { Transaction } from "../../types";

interface ExportModalProps {
  transactions: Transaction[];
  onClose: () => void;
  notify: (text: string, kind: "success" | "error") => void;
}

export function ExportModal({ transactions, onClose, notify }: ExportModalProps) {
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

  function handleDownload() {
    if (filtered.length === 0) return notify("Tidak ada transaksi pada periode yang dipilih.", "error");
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
    <Modal title="Download Rekap Transaksi" onClose={onClose}>
      {!csv ? (
        <>
          <div className="form-group">
            <label className="form-label">Pilih Periode</label>
            <div className="btn-group">
              <button
                className={`btn ${mode === "bulan" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setMode("bulan")}
              >
                Per Bulan
              </button>
              <button
                className={`btn ${mode === "rentang" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setMode("rentang")}
              >
                Rentang Tanggal
              </button>
            </div>
          </div>
          {mode === "bulan" ? (
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
            <div className="export-preview-label">Preview:</div>
            <div className="export-preview-count">
              {filtered.length === 0 ? (
                <span className="text-faint">Tidak ada transaksi pada periode ini</span>
              ) : (
                <>
                  <span className="export-preview-number">{filtered.length}</span> transaksi{" "}
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
              <Icon type="download" size={16} /> Download CSV
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="info-banner green">
            <Icon type="check" size={16} /> Rekap berhasil dibuat! Jika file tidak otomatis terdownload, salin data di
            bawah lalu paste ke Notepad/Excel.
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

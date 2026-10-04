import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { useBackButton } from "../../hooks/useBackButton";
import { daysAgo, friendlyDate, todayStr } from "../../lib/date";
import { frequentItems, itemUsage, searchItems } from "../../lib/search";
import { isLowStock, stockDelta, validateStockChanges, stockChanges, type TxData } from "../../lib/stock";
import type { Item, Transaction, TxType } from "../../types";

type Step = "item" | "qty" | "review" | "done";
const STEP_NO: Record<Exclude<Step, "done">, number> = { item: 1, qty: 2, review: 3 };
const MAX_RESULTS = 30;

/** Pilihan keterangan cepat; "Lainnya" meminta isian bebas. */
const REASONS: Record<TxType, string[]> = {
  keluar: ["Untuk pasien", "Rusak / kedaluwarsa", "Dikembalikan ke farmasi", "Lainnya"],
  masuk: ["Dari farmasi", "Pengembalian", "Lainnya"],
};
const DETAIL_PLACEHOLDER: Record<string, string> = {
  "Untuk pasien": "Nama atau nomor pasien (boleh dikosongkan)",
  Lainnya: "Tulis keterangannya",
};

export type NewTx = Omit<TxData, "operator" | "email">;

interface TxWizardProps {
  type: TxType;
  items: Item[];
  transactions: Transaction[];
  operatorName: string;
  /** Simpan transaksi; mengembalikan id transaksi baru. */
  onSave: (data: NewTx) => string;
  /** Batalkan transaksi yang baru saja disimpan; mengembalikan pesan kesalahan atau null jika berhasil. */
  onUndo: (txId: string, data: NewTx) => string | null;
  onClose: () => void;
}

const verb = (type: TxType) => (type === "masuk" ? "masuk" : "keluar");

export function TxWizard({ type, items, transactions, operatorName, onSave, onUndo, onClose }: TxWizardProps) {
  const [step, setStep] = useState<Step>("item");
  const [itemId, setItemId] = useState("");
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(todayStr());
  const [editDate, setEditDate] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ id: string; data: NewTx; stockAfter: number } | null>(null);
  const [undone, setUndone] = useState(false);

  const item = items.find((i) => i.id === itemId);
  const qtyNum = Number(qty);
  const qtyValid = Number.isInteger(qtyNum) && qtyNum > 0;
  const stockAfter = item && qtyValid ? item.stock + stockDelta(type, qtyNum) : undefined;

  const usage = useMemo(() => itemUsage(transactions, daysAgo(90)), [transactions]);
  const frequent = useMemo(() => frequentItems(items, usage, 8), [items, usage]);
  const results = useMemo(() => searchItems(items, query, usage), [items, query, usage]);

  /** Mundur satu langkah; false jika sudah di langkah pertama atau selesai (berarti tutup). */
  function goBack(): boolean {
    setError("");
    const prev: Partial<Record<Step, Step>> = { qty: "item", review: "qty" };
    const target = prev[step];
    if (target) setStep(target);
    return !!target;
  }
  // Tombol Kembali di HP mundur satu langkah, bukan keluar dari aplikasi
  const requestClose = useBackButton(() => {
    if (goBack()) return true;
    onClose();
  });

  function confirmClose() {
    if (step !== "item" && step !== "done" && !window.confirm("Batalkan pencatatan ini? Isian tadi tidak disimpan.")) {
      return;
    }
    requestClose();
  }

  function pickItem(i: Item) {
    setItemId(i.id);
    setQty("1");
    setError("");
    setStep("qty");
  }

  function toQtyReview() {
    if (!item) return setStep("item");
    if (!qtyValid) return setError("Jumlah harus angka bulat, paling sedikit 1.");
    const stockError = validateStockChanges(stockChanges({ itemId: item.id, type, qty: qtyNum }), items);
    if (stockError) return setError(stockError);
    setError("");
    setStep("review");
  }

  function save() {
    if (!item || stockAfter === undefined) return;
    const stockError = validateStockChanges(stockChanges({ itemId: item.id, type, qty: qtyNum }), items);
    if (stockError) return setError(stockError);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Tanggal belum diisi.");
    const note = [reason, detail.trim()].filter(Boolean).join(": ");
    const data: NewTx = { itemId: item.id, itemName: item.name, type, qty: qtyNum, date, note };
    const id = onSave(data);
    setSaved({ id, data, stockAfter });
    setUndone(false);
    setStep("done");
  }

  function undo() {
    if (!saved) return;
    const err = onUndo(saved.id, saved.data);
    if (err) return setError(err);
    setError("");
    setUndone(true);
  }

  function again() {
    setItemId("");
    setQuery("");
    setQty("1");
    setReason("");
    setDetail("");
    setDate(todayStr());
    setEditDate(false);
    setSaved(null);
    setError("");
    setStep("item");
  }

  const title = type === "masuk" ? "Barang Masuk" : "Barang Keluar";
  const shown = query.trim() ? results.slice(0, MAX_RESULTS) : frequent;

  return (
    <div className="wizard" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`wizard-head ${type}`}>
        <Icon type={type === "masuk" ? "arrowDown" : "arrowUp"} size={24} />
        <div className="wizard-title">
          {title}
          {step !== "done" && <div className="wizard-step">Langkah {STEP_NO[step]} dari 3</div>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={confirmClose}>
          <Icon type="x" size={18} /> Tutup
        </button>
      </div>
      {step !== "done" && (
        <div className="wizard-progress" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= STEP_NO[step] ? "done" : undefined} />
          ))}
        </div>
      )}

      <div className="wizard-body">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {step === "item" && (
          <>
            <h1 className="wizard-question">Barang apa yang {verb(type)}?</h1>
            <div className="search-big">
              <span className="search-big-icon">
                <Icon type="search" size={22} />
              </span>
              <input
                type="search"
                placeholder="Ketik nama barang..."
                aria-label="Cari nama barang"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
              {query && (
                <button className="btn btn-ghost btn-sm search-clear" onClick={() => setQuery("")}>
                  Hapus
                </button>
              )}
            </div>
            <div className="list-label">
              {query.trim()
                ? results.length > 0
                  ? `Ditemukan ${results.length} barang`
                  : ""
                : "Sering dipakai — atau ketik nama barang di atas"}
            </div>
            {query.trim() && results.length === 0 ? (
              <div className="empty-note">
                Barang "<b>{query}</b>" tidak ditemukan.
                <br />
                Coba ketik sebagian nama saja, misalnya "epi" untuk Epinefrin.
              </div>
            ) : (
              <div className="pick-list">
                {shown.map((i) => {
                  const empty = type === "keluar" && i.stock <= 0;
                  return (
                    <button
                      key={i.id}
                      className={`pick-item${empty ? " disabled" : ""}`}
                      onClick={() =>
                        empty ? setError(`Stok ${i.name} sudah habis, tidak bisa dikeluarkan.`) : pickItem(i)
                      }
                    >
                      <div>
                        <div className="pick-item-name">{i.name}</div>
                        <div className="pick-item-cat">
                          {i.category}
                          {i.kritis && " · Obat darurat"}
                        </div>
                      </div>
                      <div className="pick-item-stock">
                        {i.stock <= 0 ? (
                          <span className="text-red">Habis</span>
                        ) : (
                          <span className={isLowStock(i) ? "text-red" : undefined}>
                            {i.stock} {i.unit}
                          </span>
                        )}
                        <small>sisa</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {query.trim() && results.length > MAX_RESULTS && (
              <p className="form-hint">
                Menampilkan {MAX_RESULTS} dari {results.length}. Ketik lebih lengkap supaya lebih sedikit.
              </p>
            )}
          </>
        )}

        {step === "qty" && item && (
          <>
            <div className="chosen-item">
              <div className="chosen-item-name">{item.name}</div>
              <div className="chosen-item-stock">
                Sisa sekarang:{" "}
                <b>
                  {item.stock} {item.unit}
                </b>
              </div>
              <button className="btn-link" onClick={() => setStep("item")}>
                Ganti barang
              </button>
            </div>
            <h1 className="wizard-question">
              Berapa {item.unit} yang {verb(type)}?
            </h1>
            <div className="qty-stepper">
              <button
                className="qty-btn"
                aria-label="Kurangi satu"
                disabled={!qtyValid || qtyNum <= 1}
                onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
              >
                −
              </button>
              <input
                className="qty-input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                aria-label="Jumlah"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="qty-btn"
                aria-label="Tambah satu"
                onClick={() => setQty(String(qtyValid ? qtyNum + 1 : 1))}
              >
                +
              </button>
            </div>
            <div className="qty-unit">{item.unit}</div>
            {stockAfter !== undefined && (
              <div className="after-stock">
                {stockAfter < 0 ? (
                  <span className="text-red">
                    Stok tidak cukup. Sisa hanya {item.stock} {item.unit}.
                  </span>
                ) : (
                  <>
                    Sisa nanti:{" "}
                    <b>
                      {stockAfter} {item.unit}
                    </b>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {step === "review" && item && stockAfter !== undefined && (
          <>
            <h1 className="wizard-question">Periksa sekali lagi</h1>
            <div className={`review-card ${type}`}>
              <div className={`review-verb ${type}`}>{type === "masuk" ? "BARANG MASUK" : "BARANG KELUAR"}</div>
              <div className="review-main">
                {qtyNum} {item.unit} {item.name}
              </div>
              <div className="review-line">
                <span>Sisa sekarang</span>
                <span>
                  {item.stock} {item.unit}
                </span>
              </div>
              <div className="review-line">
                <span>Sisa nanti</span>
                <span>
                  {stockAfter} {item.unit}
                </span>
              </div>
              <div className="review-line">
                <span>Tanggal</span>
                <span>
                  {friendlyDate(date)}{" "}
                  {!editDate && (
                    <button className="btn-link" onClick={() => setEditDate(true)}>
                      Ganti
                    </button>
                  )}
                </span>
              </div>
              {editDate && (
                <input
                  className="form-input"
                  type="date"
                  aria-label="Tanggal"
                  max={todayStr()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              )}
              <div className="review-line">
                <span>Petugas</span>
                <span>{operatorName}</span>
              </div>
            </div>

            <div className="form-group">
              <div className="form-label">Keterangan (boleh dilewati)</div>
              <div className="chips">
                {REASONS[type].map((r) => (
                  <button
                    key={r}
                    className={`chip${reason === r ? " active" : ""}`}
                    aria-pressed={reason === r}
                    onClick={() => setReason(reason === r ? "" : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {(reason === "Untuk pasien" || reason === "Lainnya") && (
                <input
                  className="form-input"
                  placeholder={DETAIL_PLACEHOLDER[reason]}
                  aria-label={DETAIL_PLACEHOLDER[reason]}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
              )}
            </div>
          </>
        )}

        {step === "done" && saved && (
          <div className="done-screen" role="status">
            {undone ? (
              <>
                <div className="done-voided">Catatan tadi sudah dibatalkan. Stok kembali seperti semula.</div>
                <div className="done-actions">
                  <button className="btn btn-primary btn-lg" onClick={again}>
                    Catat ulang dengan benar
                  </button>
                  <button className="btn btn-ghost btn-lg" onClick={requestClose}>
                    Kembali ke Beranda
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="done-icon">
                  <Icon type="check" size={48} />
                </div>
                <div className="done-title">Tersimpan</div>
                <div className="done-text">
                  {saved.data.qty} {item?.unit} {saved.data.itemName} {verb(type)}.
                </div>
                <div className="done-sub">
                  Sisa sekarang: {saved.stockAfter} {item?.unit}
                  {!navigator.onLine && (
                    <>
                      <br />
                      Tidak ada sinyal: catatan tersimpan di HP ini dan terkirim otomatis nanti.
                    </>
                  )}
                </div>
                <div className="done-actions">
                  <button className="btn btn-primary btn-lg" onClick={again}>
                    Catat barang lain
                  </button>
                  <button className="btn btn-ghost btn-lg" onClick={requestClose}>
                    Selesai, kembali ke Beranda
                  </button>
                  <button className="btn btn-danger" onClick={undo}>
                    <Icon type="undo" size={18} /> Salah catat? Batalkan
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {(step === "qty" || step === "review") && (
        <div className="wizard-foot">
          <div className="wizard-foot-inner">
            <button className="btn btn-ghost btn-lg" onClick={() => history.back()}>
              ← Kembali
            </button>
            {step === "qty" ? (
              <button className="btn btn-primary btn-lg" onClick={toQtyReview} disabled={!qtyValid}>
                Lanjut →
              </button>
            ) : (
              <button className={`btn btn-lg ${type === "masuk" ? "btn-masuk" : "btn-keluar"}`} onClick={save}>
                <Icon type="check" size={22} /> Simpan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

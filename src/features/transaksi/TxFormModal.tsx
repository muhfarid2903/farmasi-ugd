import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { todayStr } from "../../lib/date";
import type { TxData } from "../../lib/repository";
import { isLowStock, stockChanges, validateStockChanges, validateTxForm, type TxForm } from "../../lib/stock";
import type { Item, Transaction, TxType } from "../../types";

const MAX_RESULTS = 50;

interface TxFormModalProps {
  items: Item[];
  /** Transaksi yang diedit; kosong berarti transaksi baru. */
  editTx?: Transaction;
  initialType: TxType;
  onSubmit: (data: TxData, prev?: Transaction) => void;
  onClose: () => void;
}

export function TxFormModal({ items, editTx, initialType, onSubmit, onClose }: TxFormModalProps) {
  const [form, setForm] = useState<TxForm>(() =>
    editTx
      ? {
          itemId: editTx.itemId,
          type: editTx.type,
          qty: String(editTx.qty),
          date: editTx.date,
          note: editTx.note ?? "",
          operator: editTx.operator,
        }
      : { itemId: "", type: initialType, qty: "", date: todayStr(), note: "", operator: "" },
  );
  const [itemSearch, setItemSearch] = useState(editTx?.itemName ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof TxForm>(key: K, value: TxForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const results = useMemo(() => {
    const q = itemSearch.toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, itemSearch]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectItem(item: Item) {
    set("itemId", item.id);
    setItemSearch(item.name);
    setShowDropdown(false);
  }

  function handleSubmit() {
    const formError = validateTxForm(form);
    if (formError) return setError(formError);
    const item = items.find((i) => i.id === form.itemId);
    if (!item) return setError("Item tidak ditemukan di database");

    const qty = Number(form.qty);
    // Dicek terhadap data terakhir di perangkat; saat offline ini adalah data cache.
    const stockError = validateStockChanges(stockChanges({ itemId: item.id, type: form.type, qty }, editTx), items);
    if (stockError) return setError(stockError);

    onSubmit(
      {
        itemId: item.id,
        itemName: item.name,
        type: form.type,
        qty,
        date: form.date,
        note: form.note.trim(),
        operator: form.operator.trim(),
      },
      editTx,
    );
  }

  const title = editTx ? "Edit Transaksi" : form.type === "masuk" ? "Catat Barang Masuk" : "Catat Barang Keluar";

  return (
    <Modal title={title} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Tipe Transaksi</label>
        <div className="btn-group">
          <button
            className={`btn ${form.type === "masuk" ? "btn-masuk" : "btn-ghost"}`}
            onClick={() => set("type", "masuk")}
          >
            <Icon type="arrowDown" size={16} /> Masuk
          </button>
          <button
            className={`btn ${form.type === "keluar" ? "btn-keluar" : "btn-ghost"}`}
            onClick={() => set("type", "keluar")}
          >
            <Icon type="arrowUp" size={16} /> Keluar
          </button>
        </div>
      </div>

      <div className="form-group item-picker" ref={dropdownRef}>
        <label className="form-label" htmlFor="tx-item">
          Pilih Item
        </label>
        <div className="input-icon">
          <input
            id="tx-item"
            className="form-input"
            placeholder="Ketik nama obat/bahan untuk mencari..."
            autoComplete="off"
            value={itemSearch}
            onChange={(e) => {
              setItemSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) set("itemId", "");
            }}
            onFocus={() => setShowDropdown(true)}
          />
          <span className="input-icon-glyph">
            <Icon type="search" size={16} />
          </span>
        </div>
        {showDropdown && (
          <div className="item-dropdown">
            {results.length === 0 ? (
              <div className="item-dropdown-empty">Tidak ditemukan</div>
            ) : (
              results.slice(0, MAX_RESULTS).map((i) => (
                <div
                  key={i.id}
                  className={`item-dropdown-row${form.itemId === i.id ? " selected" : ""}`}
                  onClick={() => selectItem(i)}
                >
                  <div className="item-dropdown-name">{i.name}</div>
                  <div className="item-dropdown-meta">
                    <span className="tag tag-cat tag-xs">{i.category}</span>
                    <span
                      className={`mono stock-hint ${
                        i.stock === 0 ? "stock-hint-empty" : isLowStock(i) ? "stock-hint-low" : ""
                      }`}
                    >
                      Stok: {i.stock} {i.unit}
                    </span>
                  </div>
                </div>
              ))
            )}
            {results.length > MAX_RESULTS && (
              <div className="item-dropdown-empty">
                Menampilkan {MAX_RESULTS} dari {results.length} item. Ketik lebih spesifik...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="tx-qty">
            Jumlah
          </label>
          <input
            id="tx-qty"
            className="form-input"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={form.qty}
            onChange={(e) => set("qty", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tx-date">
            Tanggal
          </label>
          <input
            id="tx-date"
            className="form-input"
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="tx-operator">
          Petugas
        </label>
        <input
          id="tx-operator"
          className="form-input"
          placeholder="Nama perawat/petugas"
          value={form.operator}
          onChange={(e) => set("operator", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="tx-note">
          Keterangan
        </label>
        <input
          id="tx-note"
          className="form-input"
          placeholder="Contoh: Dari Farmasi / Pasien IGD-001"
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          <Icon type="check" size={16} /> {editTx ? "Simpan Perubahan" : "Simpan"}
        </button>
      </div>
    </Modal>
  );
}

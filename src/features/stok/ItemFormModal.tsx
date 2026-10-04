import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import type { ItemData } from "../../lib/repository";
import { validateItemForm, type ItemForm } from "../../lib/stock";
import { CATEGORIES, UNITS, type Category, type Item } from "../../types";

interface ItemFormModalProps {
  /** Item yang diedit; kosong berarti item baru. */
  editItem?: Item;
  onSubmit: (data: ItemData, editItem?: Item) => void;
  onClose: () => void;
}

const emptyForm: ItemForm = { name: "", category: "Obat", unit: "tablet", stock: "", minStock: "", kritis: false };

export function ItemFormModal({ editItem, onSubmit, onClose }: ItemFormModalProps) {
  const [form, setForm] = useState<ItemForm>(() =>
    editItem
      ? {
          name: editItem.name,
          category: editItem.category,
          unit: editItem.unit,
          stock: String(editItem.stock),
          minStock: String(editItem.minStock),
          kritis: editItem.kritis ?? false,
        }
      : emptyForm,
  );
  const [error, setError] = useState("");

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit() {
    const formError = validateItemForm(form);
    if (formError) return setError(formError);
    onSubmit(
      {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        stock: Number(form.stock),
        minStock: Number(form.minStock),
        kritis: form.kritis,
      },
      editItem,
    );
  }

  return (
    <Modal title={editItem ? "Edit Item" : "Tambah Item Baru"} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-group">
        <label className="form-label" htmlFor="item-name">
          Nama Item
        </label>
        <input
          id="item-name"
          className="form-input"
          placeholder="Contoh: Paracetamol 500mg"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="item-category">
            Kategori
          </label>
          <select
            id="item-category"
            className="form-input"
            value={form.category}
            onChange={(e) => set("category", e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="item-unit">
            Satuan
          </label>
          <select id="item-unit" className="form-input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {/* Satuan lama yang tidak ada di daftar tetap ditampilkan agar tidak hilang saat disimpan */}
            {!(UNITS as readonly string[]).includes(form.unit) && <option value={form.unit}>{form.unit}</option>}
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="item-stock">
            {editItem ? "Stok Saat Ini" : "Stok Awal"}
          </label>
          <input
            id="item-stock"
            className="form-input"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.stock}
            onChange={(e) => set("stock", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="item-min">
            Minimum Stok
          </label>
          <input
            id="item-min"
            className="form-input"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.minStock}
            onChange={(e) => set("minStock", e.target.value)}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Prioritas</label>
        <button
          type="button"
          className={`kritis-toggle${form.kritis ? " active" : ""}`}
          onClick={() => set("kritis", !form.kritis)}
          aria-pressed={form.kritis}
        >
          <div className={`kritis-check${form.kritis ? " checked" : ""}`}>
            {form.kritis && <Icon type="check" size={14} />}
          </div>
          <div>
            <div className={`kritis-label${form.kritis ? " text-red" : ""}`}>Obat / Bahan Kritis (Emergency)</div>
            <div className="kritis-sub">Tandai jika item ini penting untuk penanganan darurat</div>
          </div>
        </button>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          <Icon type="check" size={16} /> {editItem ? "Simpan" : "Tambah"}
        </button>
      </div>
    </Modal>
  );
}

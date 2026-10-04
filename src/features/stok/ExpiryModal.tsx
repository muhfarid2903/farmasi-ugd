import { useState } from "react";
import { ExpiryPicker } from "../../components/ExpiryPicker";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { formatExpiry } from "../../lib/expiry";
import type { Item } from "../../types";

interface ExpiryModalProps {
  item: Item;
  onSave: (expiry: string | null) => void;
  onClose: () => void;
}

/** Perbarui ED terdekat, mis. setelah stok dengan ED lama sudah terpakai habis. */
export function ExpiryModal({ item, onSave, onClose }: ExpiryModalProps) {
  const [value, setValue] = useState(item.expiry ?? "");

  return (
    <Modal title="Tanggal Kedaluwarsa (ED)" onClose={onClose}>
      <div className="void-summary">
        <div className="semibold">{item.name}</div>
        <div className="muted small">
          Sisa {item.stock} {item.unit} · ED sekarang: {item.expiry ? formatExpiry(item.expiry) : "belum diisi"}
        </div>
      </div>
      <p className="void-explain">
        Isi ED yang <b>paling cepat</b> di antara barang yang ada di rak. Lihat tulisan "ED" atau "Exp" di kemasan.
      </p>
      <ExpiryPicker value={value} onChange={setValue} idPrefix="ed" />
      <div className="modal-actions spaced">
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={() => onSave(value || null)}>
          <Icon type="check" size={18} /> Simpan ED
        </button>
      </div>
    </Modal>
  );
}

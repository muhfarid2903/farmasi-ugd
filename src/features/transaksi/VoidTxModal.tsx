import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { formatDate } from "../../lib/date";
import type { Transaction } from "../../types";

interface VoidTxModalProps {
  tx: Transaction;
  /** Pesan jika pembatalan tidak bisa dilakukan (mis. stok tidak cukup). */
  blockedReason: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function VoidTxModal({ tx, blockedReason, onConfirm, onClose }: VoidTxModalProps) {
  const [reason, setReason] = useState("");
  const effect = tx.type === "masuk" ? "dikurangi" : "dikembalikan";

  return (
    <Modal title="Batalkan Transaksi" onClose={onClose}>
      <div className="void-summary">
        <div className="semibold">{tx.itemName}</div>
        <div className="muted small">
          {tx.type === "masuk" ? "Masuk" : "Keluar"} {tx.qty} · {formatDate(tx.date)} · {tx.operator}
        </div>
      </div>
      <p className="void-explain">
        Transaksi asli tetap tersimpan sebagai jejak, lalu dibuat transaksi pembatalan sehingga stok {effect} sebanyak{" "}
        {tx.qty}. Setelah itu, catat ulang transaksi yang benar bila perlu.
      </p>
      {blockedReason && <div className="form-error">{blockedReason}</div>}
      <div className="form-group">
        <label className="form-label" htmlFor="void-reason">
          Alasan (opsional)
        </label>
        <input
          id="void-reason"
          className="form-input"
          placeholder="Contoh: salah jumlah, salah item"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Kembali
        </button>
        <button className="btn btn-danger" disabled={!!blockedReason} onClick={() => onConfirm(reason)}>
          <Icon type="undo" size={16} /> Batalkan Transaksi
        </button>
      </div>
    </Modal>
  );
}

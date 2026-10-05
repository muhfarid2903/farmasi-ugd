import { Icon } from "../../components/Icon";
import { friendlyDate } from "../../lib/date";
import type { Transaction } from "../../types";

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

interface TxCardProps {
  tx: Transaction;
  unit?: string;
  /** Tampilkan tombol Batalkan jika diisi. */
  onVoid?: () => void;
}

/** Satu catatan barang masuk/keluar, ditulis sebagai kalimat. */
export function TxCard({ tx, unit = "", onVoid }: TxCardProps) {
  const voided = !!tx.voidedBy;
  return (
    <div className={`tx-card${voided ? " voided" : ""}`}>
      <span className={`recent-dir ${tx.type}`} aria-hidden="true">
        <Icon type={tx.type === "masuk" ? "arrowDown" : "arrowUp"} size={18} />
      </span>
      <div className="tx-card-body">
        <div className="tx-card-text">
          <b>{tx.operator}</b>{" "}
          {tx.adjust
            ? tx.type === "masuk"
              ? "menambah stok"
              : "mengurangi stok"
            : tx.type === "masuk"
              ? "menerima"
              : "mengeluarkan"}{" "}
          <b>
            {tx.qty} {unit}
          </b>{" "}
          {tx.itemName}
        </div>
        {tx.note && <div className="tx-card-note">{tx.note}</div>}
        <div className="recent-meta">
          {friendlyDate(tx.date)}
          {tx.createdAt && `, pukul ${timeOf(tx.createdAt)}`}
        </div>
        {(voided || tx.voidsTxId) && (
          <span className="tag tag-void">{voided ? "Sudah dibatalkan" : "Pembatalan catatan sebelumnya"}</span>
        )}
        {tx.adjust && (
          <span className="tag tag-adjust">
            {tx.adjust === "opname" ? "Penyesuaian stok opname" : "Koreksi stok oleh admin"}
          </span>
        )}
      </div>
      {onVoid && (
        <button className="btn btn-ghost btn-sm" onClick={onVoid}>
          <Icon type="undo" size={16} /> Batalkan
        </button>
      )}
    </div>
  );
}

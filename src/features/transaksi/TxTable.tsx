import { Icon } from "../../components/Icon";
import { formatDate } from "../../lib/date";
import type { Transaction } from "../../types";

interface TxTableProps {
  transactions: Transaction[];
  canVoid: (tx: Transaction) => boolean;
  onVoid: (tx: Transaction) => void;
  emptyText: string;
}

export function TxTable({ transactions, canVoid, onVoid, emptyText }: TxTableProps) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Barang</th>
            <th>Masuk/Keluar</th>
            <th>Jumlah</th>
            <th>Keterangan</th>
            <th>Petugas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            transactions.map((tx) => (
              <tr key={tx.id} className={tx.voidedBy ? "tx-voided" : undefined}>
                <td className="small">{formatDate(tx.date)}</td>
                <td className="medium">{tx.itemName}</td>
                <td>
                  <span className={`tag tag-${tx.type}`}>{tx.type === "masuk" ? "↓ Masuk" : "↑ Keluar"}</span>
                  {tx.voidedBy && <span className="tag tag-void">Dibatalkan</span>}
                  {tx.voidsTxId && <span className="tag tag-void">Pembatalan</span>}
                </td>
                <td className="bold">{tx.qty}</td>
                <td className="muted">{tx.note || "-"}</td>
                <td>{tx.operator}</td>
                <td>
                  {canVoid(tx) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onVoid(tx)}>
                      <Icon type="undo" size={16} /> Batalkan
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

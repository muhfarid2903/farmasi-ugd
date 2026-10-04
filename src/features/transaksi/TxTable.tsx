import { Icon } from "../../components/Icon";
import { formatDate } from "../../lib/date";
import type { Transaction } from "../../types";

interface TxTableProps {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  emptyText: string;
}

export function TxTable({ transactions, onEdit, emptyText }: TxTableProps) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Item</th>
            <th>Tipe</th>
            <th>Jumlah</th>
            <th>Keterangan</th>
            <th>Petugas</th>
            <th>Aksi</th>
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
              <tr key={tx.id}>
                <td className="mono small">{formatDate(tx.date)}</td>
                <td className="medium">{tx.itemName}</td>
                <td>
                  <span className={`tag tag-${tx.type}`}>{tx.type === "masuk" ? "↓ Masuk" : "↑ Keluar"}</span>
                </td>
                <td className="mono bold">{tx.qty}</td>
                <td className="muted">{tx.note || "-"}</td>
                <td>{tx.operator}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(tx)} aria-label="Edit transaksi">
                    <Icon type="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

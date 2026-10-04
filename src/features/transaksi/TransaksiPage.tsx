import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import type { Transaction, TxType } from "../../types";
import { TxTable } from "./TxTable";

interface TransaksiPageProps {
  transactions: Transaction[];
  onNewTx: (type: TxType) => void;
  canVoid: (tx: Transaction) => boolean;
  onVoidTx: (tx: Transaction) => void;
  onExport: () => void;
}

export function TransaksiPage({ transactions, onNewTx, canVoid, onVoidTx, onExport }: TransaksiPageProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"semua" | TxType>("semua");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        ((t.itemName ?? "").toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q)) &&
        (filterType === "semua" || t.type === filterType),
    );
  }, [transactions, search, filterType]);

  return (
    <>
      <h1 className="page-title">Riwayat Transaksi</h1>
      <p className="page-sub">Catatan seluruh barang masuk dan keluar UGD</p>
      <div className="toolbar">
        <div className="search-box">
          <Icon type="search" size={16} />
          <input
            placeholder="Cari item atau keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as "semua" | TxType)}
          className="select-box"
        >
          <option value="semua">Semua Tipe</option>
          <option value="masuk">Masuk</option>
          <option value="keluar">Keluar</option>
        </select>
        <button className="btn btn-masuk" onClick={() => onNewTx("masuk")}>
          <Icon type="arrowDown" size={16} /> Masuk
        </button>
        <button className="btn btn-keluar" onClick={() => onNewTx("keluar")}>
          <Icon type="arrowUp" size={16} /> Keluar
        </button>
        <button className="btn btn-ghost btn-export" onClick={onExport}>
          <Icon type="download" size={16} /> Download Rekap
        </button>
      </div>
      <div className="panel">
        <TxTable transactions={filtered} canVoid={canVoid} onVoid={onVoidTx} emptyText="Tidak ada transaksi" />
      </div>
    </>
  );
}

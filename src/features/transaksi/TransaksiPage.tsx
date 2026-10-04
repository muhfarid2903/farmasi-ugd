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
      <h1 className="page-title">Riwayat</h1>
      <p className="page-sub">Semua catatan barang masuk dan keluar UGD. Catatan yang salah bisa dibatalkan.</p>
      <div className="toolbar">
        <div className="search-box">
          <Icon type="search" size={16} />
          <input
            placeholder="Cari nama barang atau keterangan..."
            aria-label="Cari riwayat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as "semua" | TxType)}
          className="select-box"
        >
          <option value="semua">Masuk dan keluar</option>
          <option value="masuk">Hanya barang masuk</option>
          <option value="keluar">Hanya barang keluar</option>
        </select>
        <button className="btn btn-masuk" onClick={() => onNewTx("masuk")}>
          <Icon type="arrowDown" size={18} /> Barang Masuk
        </button>
        <button className="btn btn-keluar" onClick={() => onNewTx("keluar")}>
          <Icon type="arrowUp" size={18} /> Barang Keluar
        </button>
        <button className="btn btn-ghost" onClick={onExport}>
          <Icon type="download" size={18} /> Unduh Laporan
        </button>
      </div>
      <div className="panel">
        <TxTable transactions={filtered} canVoid={canVoid} onVoid={onVoidTx} emptyText="Tidak ada catatan yang cocok" />
      </div>
    </>
  );
}

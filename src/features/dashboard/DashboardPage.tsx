import { useMemo } from "react";
import { Icon } from "../../components/Icon";
import { formatDate, todayStr } from "../../lib/date";
import { isLowStock } from "../../lib/stock";
import type { Item, Transaction, TxType } from "../../types";
import { TxTable } from "../transaksi/TxTable";

interface DashboardPageProps {
  items: Item[];
  transactions: Transaction[];
  onNewTx: (type: TxType) => void;
  canVoid: (tx: Transaction) => boolean;
  onVoidTx: (tx: Transaction) => void;
  /** Kosong jika pengguna bukan admin (tombol Tambah Item disembunyikan). */
  onAddItem?: () => void;
  onExport: () => void;
}

function StockAlert({ item, critical }: { item: Item; critical: boolean }) {
  const p = critical ? "critical-stock" : "low-stock";
  return (
    <div className={`${p}-card`}>
      <div>
        <div className={`${p}-name`}>{item.name}</div>
        <div className="low-stock-detail">
          {item.category} · Min: {item.minStock} {item.unit}
        </div>
      </div>
      <div className="align-right">
        <div className={`${p}-count`}>{item.stock}</div>
        <div className="unit-label">{item.unit}</div>
      </div>
    </div>
  );
}

export function DashboardPage({
  items,
  transactions,
  onNewTx,
  canVoid,
  onVoidTx,
  onAddItem,
  onExport,
}: DashboardPageProps) {
  const today = todayStr();
  const { critical, regular, lowCount } = useMemo(() => {
    const low = items.filter(isLowStock);
    return { critical: low.filter((i) => i.kritis), regular: low.filter((i) => !i.kritis), lowCount: low.length };
  }, [items]);
  const totalStock = useMemo(() => items.reduce((s, i) => s + i.stock, 0), [items]);
  const todayTxCount = useMemo(() => transactions.filter((t) => t.date === today).length, [transactions, today]);

  return (
    <>
      <h1 className="page-title">Dashboard UGD</h1>
      <p className="page-sub">Puskesmas Liukang Tupabbiring, Kab. Pangkep — {formatDate(today)}</p>
      <div className="info-banner green">
        <Icon type="wifi" size={16} /> Data tersinkronisasi real-time ke semua perangkat petugas UGD, dan tetap bisa
        dicatat saat sinyal hilang.
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Jenis Item</div>
          <div className="stat-value blue">{items.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Stok</div>
          <div className="stat-value green">{totalStock.toLocaleString("id-ID")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Transaksi Hari Ini</div>
          <div className="stat-value orange">{todayTxCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stok Menipis</div>
          <div className="stat-value red">
            {critical.length > 0 && `${critical.length} kritis · `}
            {lowCount}
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <button className="quick-btn" onClick={() => onNewTx("masuk")}>
          <div className="icon-wrap icon-green">
            <Icon type="arrowDown" size={22} />
          </div>
          <div>
            <div className="qb-title">Barang Masuk</div>
            <div className="qb-sub">Catat penerimaan obat/bahan</div>
          </div>
        </button>
        <button className="quick-btn" onClick={() => onNewTx("keluar")}>
          <div className="icon-wrap icon-orange">
            <Icon type="arrowUp" size={22} />
          </div>
          <div>
            <div className="qb-title">Barang Keluar</div>
            <div className="qb-sub">Catat pengeluaran obat/bahan</div>
          </div>
        </button>
        {onAddItem && (
          <button className="quick-btn" onClick={onAddItem}>
            <div className="icon-wrap icon-blue">
              <Icon type="plus" size={22} />
            </div>
            <div>
              <div className="qb-title">Tambah Item</div>
              <div className="qb-sub">Daftarkan obat/bahan baru</div>
            </div>
          </button>
        )}
        <button className="quick-btn" onClick={onExport}>
          <div className="icon-wrap icon-purple">
            <Icon type="download" size={22} />
          </div>
          <div>
            <div className="qb-title">Download Rekap</div>
            <div className="qb-sub">Ekspor transaksi per bulan/tanggal</div>
          </div>
        </button>
      </div>

      {critical.length > 0 && (
        <>
          <div className="section-title">
            <div className="dot dot-red-pulse" />{" "}
            <span className="text-red">KRITIS — Obat & Bahan Emergency Menipis</span>
          </div>
          {critical.map((it) => (
            <StockAlert key={it.id} item={it} critical />
          ))}
        </>
      )}
      {regular.length > 0 && (
        <>
          <div className={`section-title${critical.length > 0 ? " section-gap" : ""}`}>
            <div className="dot dot-orange" /> Peringatan Stok Menipis
          </div>
          {regular.map((it) => (
            <StockAlert key={it.id} item={it} critical={false} />
          ))}
        </>
      )}

      <div className="recent-tx">
        <div className="recent-tx-header">
          <div className="section-title no-margin">
            <div className="dot dot-accent" /> Transaksi Terakhir
          </div>
        </div>
        <TxTable
          transactions={transactions.slice(0, 5)}
          canVoid={canVoid}
          onVoid={onVoidTx}
          emptyText="Belum ada transaksi"
        />
      </div>
    </>
  );
}

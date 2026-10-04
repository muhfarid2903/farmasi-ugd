import { useMemo } from "react";
import { Icon } from "../../components/Icon";
import { friendlyDate, fullDate, greeting } from "../../lib/date";
import { isLowStock } from "../../lib/stock";
import type { Item, Transaction, TxType } from "../../types";

const ALERT_LIMIT = 5;
const RECENT_LIMIT = 5;

interface BerandaPageProps {
  userName: string;
  items: Item[];
  transactions: Transaction[];
  onNewTx: (type: TxType) => void;
  onShowStock: () => void;
  onShowHistory: () => void;
  onExport: () => void;
  /** Kosong jika pengguna bukan admin. */
  onAddItem?: () => void;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function BerandaPage({
  userName,
  items,
  transactions,
  onNewTx,
  onShowStock,
  onShowHistory,
  onExport,
  onAddItem,
}: BerandaPageProps) {
  const { critical, regularCount } = useMemo(() => {
    const low = items.filter(isLowStock).sort((a, b) => a.stock - b.stock);
    return { critical: low.filter((i) => i.kritis), regularCount: low.filter((i) => !i.kritis).length };
  }, [items]);
  const unitOf = useMemo(() => new Map(items.map((i) => [i.id, i.unit])), [items]);
  const recent = transactions.slice(0, RECENT_LIMIT);

  return (
    <>
      <div className="home-greeting">
        {greeting()}, {userName}
      </div>
      <div className="home-date">{fullDate()}</div>

      <div className="big-actions">
        <button className="big-action masuk" onClick={() => onNewTx("masuk")}>
          <span className="big-action-icon">
            <Icon type="arrowDown" size={32} />
          </span>
          <span>
            <span className="big-action-title">Barang Masuk</span>
            <br />
            <span className="big-action-sub">Terima barang dari farmasi</span>
          </span>
        </button>
        <button className="big-action keluar" onClick={() => onNewTx("keluar")}>
          <span className="big-action-icon">
            <Icon type="arrowUp" size={32} />
          </span>
          <span>
            <span className="big-action-title">Barang Keluar</span>
            <br />
            <span className="big-action-sub">Dipakai untuk pasien</span>
          </span>
        </button>
      </div>

      <h2 className="section-title">Obat & bahan darurat</h2>
      {critical.length === 0 ? (
        <div className="all-good">
          <Icon type="check" size={22} /> Semua obat & bahan darurat stoknya cukup.
        </div>
      ) : (
        <div className="alert-panel">
          <div className="alert-panel-title">
            <Icon type="alert" size={22} /> {critical.length} barang darurat hampir habis
          </div>
          {critical.slice(0, ALERT_LIMIT).map((it) => (
            <div key={it.id} className="alert-row">
              <div>
                <div className="alert-row-name">{it.name}</div>
                <div className="alert-row-cat">
                  Batas minimum {it.minStock} {it.unit}
                </div>
              </div>
              <div className="alert-row-count">
                {it.stock <= 0 ? "Habis" : `${it.stock} ${it.unit}`}
                <small>sisa</small>
              </div>
            </div>
          ))}
          {critical.length > ALERT_LIMIT && (
            <div className="alert-more">
              <button className="btn-link" onClick={onShowStock}>
                Lihat semua ({critical.length}) →
              </button>
            </div>
          )}
        </div>
      )}
      {regularCount > 0 && (
        <p className="form-hint">
          Selain itu ada {regularCount} barang biasa yang hampir habis.{" "}
          <button className="btn-link" onClick={onShowStock}>
            Lihat di halaman Stok
          </button>
        </p>
      )}

      <h2 className="section-title">Catatan terakhir</h2>
      {recent.length === 0 ? (
        <div className="empty-note">Belum ada catatan barang masuk atau keluar.</div>
      ) : (
        <div className="recent-list">
          {recent.map((tx) => (
            <div key={tx.id} className="recent-row">
              <span className={`recent-dir ${tx.type}`}>
                <Icon type={tx.type === "masuk" ? "arrowDown" : "arrowUp"} size={18} />
              </span>
              <div className="recent-text">
                <div className={tx.voidedBy ? "text-faint" : undefined}>
                  <b>{tx.operator}</b> {tx.type === "masuk" ? "menerima" : "mengeluarkan"} {tx.qty}{" "}
                  {unitOf.get(tx.itemId) ?? ""} {tx.itemName}
                  {tx.voidedBy && " (dibatalkan)"}
                  {tx.voidsTxId && " (pembatalan)"}
                </div>
                <div className="recent-meta">
                  {friendlyDate(tx.date)}
                  {tx.createdAt && `, pukul ${timeOf(tx.createdAt)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="btn-link" onClick={onShowHistory}>
        Lihat semua riwayat →
      </button>

      <div className="home-links">
        <button className="btn btn-ghost" onClick={onExport}>
          <Icon type="download" size={18} /> Unduh Laporan (Excel)
        </button>
        {onAddItem && (
          <button className="btn btn-ghost" onClick={onAddItem}>
            <Icon type="plus" size={18} /> Tambah Barang Baru
          </button>
        )}
      </div>
    </>
  );
}

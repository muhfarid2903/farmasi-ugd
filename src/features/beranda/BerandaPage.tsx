import { useMemo } from "react";
import { Icon } from "../../components/Icon";
import { fullDate, greeting, todayStr } from "../../lib/date";
import { expiringItems, expiryStatus, expiryText, formatExpiry } from "../../lib/expiry";
import { isLowStock } from "../../lib/stock";
import type { StockFilter } from "../../lib/stock";
import type { Item, Transaction, TxType } from "../../types";
import { TxCard } from "../transaksi/TxCard";

const ALERT_LIMIT = 5;
const RECENT_LIMIT = 5;

interface BerandaPageProps {
  userName: string;
  items: Item[];
  transactions: Transaction[];
  onNewTx: (type: TxType) => void;
  onShowStock: (filter?: StockFilter) => void;
  onShowHistory: () => void;
  onExport: () => void;
  /** Kosong jika pengguna bukan admin. */
  onAddItem?: () => void;
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
  const expiring = useMemo(() => expiringItems(items, todayStr()), [items]);
  const anyExpiry = useMemo(() => items.some((i) => i.expiry), [items]);
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
              <button className="btn-link" onClick={() => onShowStock("hampir")}>
                Lihat semua ({critical.length}) →
              </button>
            </div>
          )}
        </div>
      )}
      {regularCount > 0 && (
        <p className="form-hint">
          Selain itu ada {regularCount} barang biasa yang hampir habis.{" "}
          <button className="btn-link" onClick={() => onShowStock("hampir")}>
            Lihat di halaman Stok
          </button>
        </p>
      )}

      <h2 className="section-title">Tanggal kedaluwarsa (ED)</h2>
      {expiring.length > 0 ? (
        <div className="alert-panel warn">
          <div className="alert-panel-title">
            <Icon type="alert" size={22} /> {expiring.length} barang sudah atau segera kedaluwarsa
          </div>
          {expiring.slice(0, ALERT_LIMIT).map((it) => {
            const lewat = expiryStatus(it.expiry!, todayStr()) === "lewat";
            return (
              <div key={it.id} className="alert-row">
                <div>
                  <div className="alert-row-name">{it.name}</div>
                  <div className="alert-row-cat">
                    Sisa {it.stock} {it.unit}
                    {it.kritis && " · Obat darurat"}
                  </div>
                </div>
                <div className={`alert-row-count${lewat ? " text-red" : ""}`}>
                  {lewat ? "Sudah lewat" : formatExpiry(it.expiry!)}
                  <small>{lewat ? `ED ${formatExpiry(it.expiry!)}` : expiryText(it.expiry!, todayStr())}</small>
                </div>
              </div>
            );
          })}
          <div className="alert-more">
            <button className="btn-link" onClick={() => onShowStock("ed")}>
              {expiring.length > ALERT_LIMIT ? `Lihat semua (${expiring.length}) →` : "Buka di halaman Stok →"}
            </button>
          </div>
        </div>
      ) : anyExpiry ? (
        <div className="all-good">
          <Icon type="check" size={22} /> Tidak ada barang yang kedaluwarsa dalam 3 bulan ke depan.
        </div>
      ) : (
        <div className="empty-note">
          ED belum diisi untuk barang mana pun. Isi ED saat mencatat <b>Barang Masuk</b>, atau lewat tombol <b>ED</b> di
          halaman Stok.
        </div>
      )}

      <h2 className="section-title">Catatan terakhir</h2>
      {recent.length === 0 ? (
        <div className="empty-note">Belum ada catatan barang masuk atau keluar.</div>
      ) : (
        <div className="card-list">
          {recent.map((tx) => (
            <TxCard key={tx.id} tx={tx} unit={unitOf.get(tx.itemId)} />
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

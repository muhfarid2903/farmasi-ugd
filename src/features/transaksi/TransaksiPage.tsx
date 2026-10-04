import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { ShowMoreButton } from "../../components/ShowMore";
import { useShowMore } from "../../hooks/useShowMore";
import { daysAgo, todayStr } from "../../lib/date";
import { normalize } from "../../lib/search";
import { filterTxPeriod, type TxPeriod } from "../../lib/stock";
import type { Item, Transaction, TxType } from "../../types";
import { TxCard } from "./TxCard";

interface TransaksiPageProps {
  items: Item[];
  transactions: Transaction[];
  onNewTx: (type: TxType) => void;
  canVoid: (tx: Transaction) => boolean;
  onVoidTx: (tx: Transaction) => void;
  onExport: () => void;
}

const PERIODS: { value: TxPeriod; label: string }[] = [
  { value: "hari", label: "Hari ini" },
  { value: "minggu", label: "7 hari terakhir" },
  { value: "semua", label: "Semua" },
];
const TYPES: { value: "semua" | TxType; label: string }[] = [
  { value: "semua", label: "Masuk & keluar" },
  { value: "masuk", label: "Masuk saja" },
  { value: "keluar", label: "Keluar saja" },
];

export function TransaksiPage({ items, transactions, onNewTx, canVoid, onVoidTx, onExport }: TransaksiPageProps) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<TxPeriod>("minggu");
  const [type, setType] = useState<"semua" | TxType>("semua");
  const unitOf = useMemo(() => new Map(items.map((i) => [i.id, i.unit])), [items]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return filterTxPeriod(transactions, period, todayStr(), daysAgo(7)).filter(
      (t) =>
        (type === "semua" || t.type === type) &&
        (!q || normalize(`${t.itemName} ${t.note ?? ""} ${t.operator}`).includes(q)),
    );
  }, [transactions, search, period, type]);
  const { visible, rest, more, reset } = useShowMore(filtered);
  // Kembali ke awal daftar setiap kali saringan berubah
  useEffect(reset, [search, period, type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 className="page-title">Riwayat</h1>
      <p className="page-sub">Semua catatan barang masuk dan keluar. Catatan yang salah bisa dibatalkan.</p>

      <div className="page-actions">
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

      <div className="search-box search-box-page">
        <Icon type="search" size={20} />
        <input
          type="search"
          placeholder="Cari nama barang, petugas, atau keterangan..."
          aria-label="Cari riwayat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="chips" role="group" aria-label="Waktu">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className={`chip${period === p.value ? " active" : ""}`}
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Jenis catatan">
        {TYPES.map((t) => (
          <button
            key={t.value}
            className={`chip${type === t.value ? " active" : ""}`}
            aria-pressed={type === t.value}
            onClick={() => setType(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="list-label">{filtered.length} catatan</p>
      {filtered.length === 0 ? (
        <div className="empty-note">
          Tidak ada catatan{period === "hari" ? " hari ini" : period === "minggu" ? " dalam 7 hari terakhir" : ""}
          {search && " yang cocok dengan pencarian"}.
          {period !== "semua" && (
            <>
              {" "}
              <button className="btn-link" onClick={() => setPeriod("semua")}>
                Lihat semua waktu
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card-list">
          {visible.map((tx) => (
            <TxCard
              key={tx.id}
              tx={tx}
              unit={unitOf.get(tx.itemId)}
              onVoid={canVoid(tx) ? () => onVoidTx(tx) : undefined}
            />
          ))}
        </div>
      )}
      <ShowMoreButton rest={rest} onClick={more} />
    </>
  );
}

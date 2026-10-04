import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { ShowMoreButton } from "../../components/ShowMore";
import { useShowMore } from "../../hooks/useShowMore";
import { searchItems } from "../../lib/search";
import { filterItems, stockStatus, type StockFilter, type StockStatus } from "../../lib/stock";
import { CATEGORIES, type Item } from "../../types";

interface StokPageProps {
  items: Item[];
  /** Hanya admin yang bisa menambah dan mengubah barang. */
  isAdmin: boolean;
  onAddItem: () => void;
  onEditItem: (item: Item) => void;
}

const FILTERS: { value: StockFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "darurat", label: "Obat darurat" },
  { value: "hampir", label: "Hampir habis" },
  { value: "habis", label: "Habis" },
];

const STATUS: Record<StockStatus, { label: string; icon: "alert" | "check" }> = {
  habis: { label: "Habis", icon: "alert" },
  hampir: { label: "Hampir habis", icon: "alert" },
  cukup: { label: "Cukup", icon: "check" },
};

function StockCard({ item, onEdit }: { item: Item; onEdit?: () => void }) {
  const status = stockStatus(item);
  return (
    <div className={`stock-card status-${status}`}>
      <div className="stock-card-main">
        <div className="stock-card-name">{item.name}</div>
        <div className="stock-card-meta">
          {item.category}
          {item.kritis && <span className="tag tag-darurat">Obat darurat</span>}
        </div>
        {item.minStock > 0 && (
          <div className="stock-card-meta">
            Batas minimum {item.minStock} {item.unit}
          </div>
        )}
      </div>
      <div className="stock-card-side">
        <div className="stock-card-count">
          {item.stock} <span>{item.unit}</span>
        </div>
        <span className={`status-pill ${status}`}>
          <Icon type={STATUS[status].icon} size={14} /> {STATUS[status].label}
        </span>
        {onEdit && (
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>
            <Icon type="edit" size={16} /> Ubah
          </button>
        )}
      </div>
    </div>
  );
}

export function StokPage({ items, isAdmin, onAddItem, onEditItem }: StokPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("semua");
  const [category, setCategory] = useState("Semua");

  const filtered = useMemo(() => {
    const base = filterItems(items, filter, category);
    return search.trim() ? searchItems(base, search) : base;
  }, [items, search, filter, category]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, filterItems(items, f.value, "Semua").length])),
    [items],
  );
  const { visible, rest, more, reset } = useShowMore(filtered);
  // Kembali ke awal daftar setiap kali saringan berubah
  useEffect(reset, [search, filter, category]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 className="page-title">Stok Barang</h1>
      <p className="page-sub">Sisa obat dan bahan medis yang ada di UGD sekarang.</p>

      {isAdmin && (
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onAddItem}>
            <Icon type="plus" size={18} /> Tambah Barang Baru
          </button>
        </div>
      )}

      <div className="search-box search-box-page">
        <Icon type="search" size={20} />
        <input
          type="search"
          placeholder="Cari nama barang..."
          aria-label="Cari nama barang"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="chips" role="group" aria-label="Saring stok">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`chip${filter === f.value ? " active" : ""}`}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>
      <select
        className="select-box select-inline"
        value={category}
        aria-label="Jenis barang"
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="Semua">Semua jenis barang</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <p className="list-label">{filtered.length} barang</p>
      {filtered.length === 0 ? (
        <div className="empty-note">Tidak ada barang yang cocok.</div>
      ) : (
        <div className="card-list">
          {visible.map((item) => (
            <StockCard key={item.id} item={item} onEdit={isAdmin ? () => onEditItem(item) : undefined} />
          ))}
        </div>
      )}
      <ShowMoreButton rest={rest} onClick={more} />
    </>
  );
}

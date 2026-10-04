import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { isLowStock } from "../../lib/stock";
import { CATEGORIES, type Item } from "../../types";

type KritisFilter = "semua" | "kritis" | "non-kritis";

interface StokPageProps {
  items: Item[];
  /** Hanya admin yang bisa menambah, mengubah, menghapus, dan menandai kritis. */
  isAdmin: boolean;
  onAddItem: () => void;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onToggleKritis: (item: Item) => void;
}

export function StokPage({ items, isAdmin, onAddItem, onEditItem, onDeleteItem, onToggleKritis }: StokPageProps) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Semua");
  const [filterKritis, setFilterKritis] = useState<KritisFilter>("semua");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) &&
        (filterCat === "Semua" || i.category === filterCat) &&
        (filterKritis === "semua" || (filterKritis === "kritis") === Boolean(i.kritis)),
    );
  }, [items, search, filterCat, filterKritis]);

  return (
    <>
      <h1 className="page-title">Data Stok</h1>
      <p className="page-sub">Daftar seluruh obat dan bahan medis di UGD</p>
      <div className="toolbar">
        <div className="search-box">
          <Icon type="search" size={16} />
          <input placeholder="Cari nama obat/bahan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="select-box">
          <option value="Semua">Semua Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterKritis}
          onChange={(e) => setFilterKritis(e.target.value as KritisFilter)}
          className="select-box"
        >
          <option value="semua">Semua Status</option>
          <option value="kritis">⚠ Kritis Saja</option>
          <option value="non-kritis">Non-Kritis Saja</option>
        </select>
        {isAdmin && (
          <button className="btn btn-primary" onClick={onAddItem}>
            <Icon type="plus" size={16} /> Tambah Item
          </button>
        )}
      </div>
      <div className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Status</th>
                <th>Stok</th>
                <th>Min. Stok</th>
                {isAdmin && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="table-empty">
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="semibold">{item.name}</td>
                    <td>
                      <span className="tag tag-cat">{item.category}</span>
                    </td>
                    <td>
                      {isAdmin ? (
                        <button
                          className={`kritis-badge${item.kritis ? " active" : ""}`}
                          onClick={() => onToggleKritis(item)}
                          title="Klik untuk mengubah status kritis"
                        >
                          {item.kritis ? "⚠ KRITIS" : "—"}
                        </button>
                      ) : (
                        <span className={`kritis-badge readonly${item.kritis ? " active" : ""}`}>
                          {item.kritis ? "⚠ KRITIS" : "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      {isLowStock(item) ? (
                        <span className="stock-warn">
                          <Icon type="alert" size={14} /> {item.stock}
                        </span>
                      ) : (
                        <span className="stock-ok">{item.stock}</span>
                      )}
                    </td>
                    <td className="mono muted">{item.minStock}</td>
                    {isAdmin && (
                      <td>
                        <div className="actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onEditItem(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Icon type="edit" size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onDeleteItem(item)}
                            aria-label={`Hapus ${item.name}`}
                          >
                            <Icon type="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

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
      <h1 className="page-title">Stok Barang</h1>
      <p className="page-sub">Sisa obat dan bahan medis yang ada di UGD sekarang.</p>
      <div className="toolbar">
        <div className="search-box">
          <Icon type="search" size={16} />
          <input
            placeholder="Cari nama barang..."
            aria-label="Cari nama barang"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="select-box">
          <option value="Semua">Semua jenis</option>
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
          <option value="semua">Semua barang</option>
          <option value="kritis">Hanya obat darurat</option>
          <option value="non-kritis">Selain obat darurat</option>
        </select>
        {isAdmin && (
          <button className="btn btn-primary" onClick={onAddItem}>
            <Icon type="plus" size={18} /> Tambah Barang
          </button>
        )}
      </div>
      <div className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Jenis</th>
                <th>Darurat?</th>
                <th>Sisa</th>
                <th>Batas Minimum</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="table-empty">
                    Tidak ada barang yang cocok
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
                          title="Ketuk untuk mengubah tanda obat darurat"
                        >
                          {item.kritis ? "⚠ Darurat" : "Bukan"}
                        </button>
                      ) : (
                        <span className={`kritis-badge readonly${item.kritis ? " active" : ""}`}>
                          {item.kritis ? "⚠ Darurat" : "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      {item.stock <= 0 ? (
                        <span className="stock-warn">
                          <Icon type="alert" size={16} /> Habis
                        </span>
                      ) : isLowStock(item) ? (
                        <span className="stock-warn">
                          <Icon type="alert" size={16} /> {item.stock} {item.unit} · hampir habis
                        </span>
                      ) : (
                        <span className="stock-ok">
                          {item.stock} {item.unit}
                        </span>
                      )}
                    </td>
                    <td className="muted">{item.minStock > 0 ? `${item.minStock} ${item.unit}` : "—"}</td>
                    {isAdmin && (
                      <td>
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => onEditItem(item)}>
                            <Icon type="edit" size={16} /> Ubah
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => onDeleteItem(item)}>
                            <Icon type="trash" size={16} /> Hapus
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

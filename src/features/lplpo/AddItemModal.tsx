import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { ShowMoreButton } from "../../components/ShowMore";
import { useShowMore } from "../../hooks/useShowMore";
import { searchItems } from "../../lib/search";
import type { Item } from "../../types";

interface AddItemModalProps {
  /** Barang yang belum ada di LPLPO. */
  items: Item[];
  onAdd: (itemId: string) => void;
  onClose: () => void;
}

/** Tambahkan barang yang belum tercetak, mis. untuk meminta barang yang stoknya kosong. */
export function AddItemModal({ items, onAdd, onClose }: AddItemModalProps) {
  const [search, setSearch] = useState("");
  const [lastAdded, setLastAdded] = useState<Item | null>(null);
  const results = useMemo(() => (search.trim() ? searchItems(items, search) : items), [items, search]);
  const { visible, rest, more, reset } = useShowMore(results, 30);
  useEffect(reset, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title="Tambah Barang ke LPLPO" onClose={onClose}>
      <p className="form-hint">
        Untuk meminta barang yang belum ada di daftar, misalnya stoknya kosong sejak lama. Barang yang ditambahkan
        langsung masuk daftar.
      </p>
      {lastAdded && (
        <div className="info-banner green">
          <Icon type="check" size={16} /> {lastAdded.name} masuk daftar. Isi jumlah permintaannya setelah menekan
          Selesai (ada di paling atas).
        </div>
      )}
      <div className="search-box">
        <Icon type="search" size={20} />
        <input
          type="search"
          placeholder="Cari nama barang..."
          aria-label="Cari nama barang"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="lplpo-add-list">
        {visible.length === 0 && <p className="text-faint">Tidak ada barang yang cocok.</p>}
        {visible.map((item) => (
          <div key={item.id} className="review-line">
            <span>
              {item.name} ({item.unit})
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onAdd(item.id);
                setLastAdded(item);
              }}
            >
              <Icon type="plus" size={16} /> Tambah
            </button>
          </div>
        ))}
      </div>
      <ShowMoreButton rest={rest} onClick={more} />
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Selesai
        </button>
      </div>
    </Modal>
  );
}

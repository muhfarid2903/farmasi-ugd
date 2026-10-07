import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import {
  findDuplicateGroups,
  mergeGroup,
  mergeUpdate,
  suggestedName,
  type MergeGroup,
  type MergeUpdate,
} from "../../lib/merge";
import { searchItems } from "../../lib/search";
import type { Item } from "../../types";

type Merge = { group: MergeGroup; update: MergeUpdate };

interface GabungPageProps {
  items: Item[];
  onMerge: (merges: Merge[]) => void;
  onBackup: () => void;
  onBack: () => void;
}

const fmt = (n: number) => n.toLocaleString("id-ID");

interface GroupCardProps {
  group: MergeGroup;
  name: string;
  onName: (name: string) => void;
  onMerge: () => void;
  onRemove?: (item: Item) => void;
}

/** Satu kelompok barang yang sama: salinannya, nama hasil gabungan, dan tombol satukan. */
function GroupCard({ group, name, onName, onMerge, onRemove }: GroupCardProps) {
  const update = mergeUpdate(group, name);
  const unit = group.items[0].unit;
  return (
    <div className="settings-card merge-card">
      {group.items.map((i) => (
        <div key={i.id} className="review-line">
          <span>
            {i.name}
            {i.kritis && <span className="tag tag-darurat">Darurat</span>}
          </span>
          <span className="merge-stock">
            {fmt(i.stock)} {i.unit}
            {onRemove && (
              <button className="btn btn-ghost btn-sm" onClick={() => onRemove(i)}>
                <Icon type="x" size={16} /> Lepas
              </button>
            )}
          </span>
        </div>
      ))}
      {group.unitsDiffer ? (
        <p className="merge-warn">
          <Icon type="alert" size={18} /> Satuannya berbeda (
          {[...new Set(group.items.map((i) => i.unit))].join(" dan ")}
          ), jadi stoknya tidak bisa langsung dijumlahkan. Samakan dulu satuannya lewat <b>Stok</b> → <b>Ubah</b>,
          sesuaikan stoknya, lalu kembali ke sini.
        </p>
      ) : (
        <>
          <label className="form-label merge-name-label">
            Nama setelah disatukan
            <input className="form-input" value={name} onChange={(e) => onName(e.target.value)} />
          </label>
          <div className="merge-result">
            <span>
              Stok jadi{" "}
              <b>
                {fmt(update.stock)} {unit}
              </b>
              {update.kritis && " · tetap obat darurat"}
              {update.minStock > 0 && ` · minimum ${fmt(update.minStock)}`}
            </span>
            <button className="btn btn-primary" disabled={!update.name} onClick={onMerge}>
              <Icon type="check" size={18} /> Satukan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Menyatukan barang yang sama tetapi tercatat lebih dari sekali (khusus admin). */
export function GabungPage({ items, onMerge, onBackup, onBack }: GabungPageProps) {
  const groups = useMemo(() => findDuplicateGroups(items), [items]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Merge[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);

  const picked = useMemo(
    () => pickedIds.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [pickedIds, items],
  );
  const manual = picked.length >= 2 ? mergeGroup(picked) : null;
  const results = useMemo(
    () =>
      search.trim()
        ? searchItems(items, search)
            .filter((i) => !pickedIds.includes(i.id))
            .slice(0, 8)
        : [],
    [items, search, pickedIds],
  );

  const keyOf = (g: MergeGroup) => g.items.map((i) => i.id).join("+");
  const nameOf = (g: MergeGroup) => names[keyOf(g)] ?? suggestedName(g);
  const setName = (g: MergeGroup) => (name: string) => setNames({ ...names, [keyOf(g)]: name });
  const prepare = (g: MergeGroup): Merge => ({ group: g, update: mergeUpdate(g, nameOf(g)) });
  const ready = groups.filter((g) => !g.unitsDiffer && nameOf(g).trim());
  const extra = groups.reduce((s, g) => s + g.items.length - 1, 0);

  function apply() {
    if (!confirm) return;
    onMerge(confirm);
    if (manual && confirm.some((m) => m.group === manual)) {
      setPickedIds([]);
      setSearch("");
    }
    setConfirm(null);
  }

  return (
    <>
      <button className="btn-link" onClick={onBack}>
        ← Kembali ke Pengaturan
      </button>
      <h1 className="page-title">Gabungkan Barang Sama</h1>
      <p className="page-sub">
        Barang yang sama tetapi tercatat lebih dari sekali, misalnya beda sumber dana (DAK, DAU, JKN, PKG), disatukan
        menjadi <b>satu barang</b>. Stoknya dijumlahkan, dan riwayat lamanya tetap tersimpan dan ikut terhitung di
        rekap.
      </p>

      <div className="settings-card merge-backup">
        <span>Sebaiknya unduh cadangan data dulu sebelum menyatukan barang.</span>
        <button className="btn btn-ghost" onClick={onBackup}>
          <Icon type="download" size={18} /> Buka Cadangan Data
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="all-good">
          <Icon type="check" size={22} /> Tidak ada lagi barang dengan nama yang sama.
        </div>
      ) : (
        <div className="alert-panel warn">
          <div className="alert-panel-title">
            <Icon type="alert" size={22} /> {groups.length} barang tercatat lebih dari sekali ({extra} kartu ganda)
          </div>
          <div className="alert-row">
            <div>
              Periksa daftar di bawah. Nama setelah disatukan bisa diubah. Tekan <b>Satukan</b> per barang, atau satukan
              semuanya sekaligus.
              {ready.length < groups.length &&
                ` ${groups.length - ready.length} barang satuannya berbeda dan harus dibereskan dulu.`}
            </div>
            {ready.length > 0 && (
              <button className="btn btn-primary" onClick={() => setConfirm(ready.map(prepare))}>
                <Icon type="check" size={18} /> Satukan semua ({ready.length})
              </button>
            )}
          </div>
        </div>
      )}

      {groups.map((g) => (
        <GroupCard
          key={keyOf(g)}
          group={g}
          name={nameOf(g)}
          onName={setName(g)}
          onMerge={() => setConfirm([prepare(g)])}
        />
      ))}

      <h2 className="section-title merge-manual-title">Nama berbeda tapi barangnya sama?</h2>
      <p className="form-hint">
        Misalnya salah ketik ("Epnefrin" dan "Epinefrin"). Cari dan pilih barangnya satu per satu, paling sedikit dua.
      </p>
      <input
        className="form-input"
        placeholder="Ketik nama barang..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {results.map((i) => (
        <div key={i.id} className="review-line merge-pick">
          <span>
            {i.name}{" "}
            <small className="muted">
              ({fmt(i.stock)} {i.unit})
            </small>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPickedIds([...pickedIds, i.id])}>
            <Icon type="plus" size={16} /> Pilih
          </button>
        </div>
      ))}
      {picked.length === 1 && (
        <p className="form-hint">
          Terpilih: <b>{picked[0].name}</b>. Pilih satu barang lagi.{" "}
          <button className="btn-link" onClick={() => setPickedIds([])}>
            Batal
          </button>
        </p>
      )}
      {manual && (
        <GroupCard
          group={manual}
          name={nameOf(manual)}
          onName={setName(manual)}
          onMerge={() => setConfirm([prepare(manual)])}
          onRemove={(item) => setPickedIds(pickedIds.filter((id) => id !== item.id))}
        />
      )}

      {confirm && (
        <Modal title="Satukan barang?" onClose={() => setConfirm(null)}>
          {confirm.length === 1 ? (
            <p className="page-sub">
              {confirm[0].group.items.length} kartu akan disatukan menjadi <b>{confirm[0].update.name}</b> dengan stok{" "}
              <b>
                {fmt(confirm[0].update.stock)} {confirm[0].group.items[0].unit}
              </b>
              .
            </p>
          ) : (
            <p className="page-sub">
              <b>{confirm.length} barang</b> ({confirm.reduce((s, m) => s + m.group.items.length, 0)} kartu) akan
              disatukan, masing-masing menjadi satu kartu.
            </p>
          )}
          <p className="void-explain">
            Perpindahan stok dicatat sebagai koreksi. Kartu lama disembunyikan, tetapi riwayatnya tetap tersimpan dan
            ikut terhitung di rekap. Penyatuan tidak bisa dibatalkan dari aplikasi.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={apply}>
              <Icon type="check" size={18} /> Ya, satukan
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

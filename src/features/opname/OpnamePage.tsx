import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { ShowMoreButton } from "../../components/ShowMore";
import { useShowMore } from "../../hooks/useShowMore";
import { diffText, opnameDiff, opnameEntries, parseCount } from "../../lib/opname";
import { searchItems } from "../../lib/search";
import { CATEGORIES, type Item, type OpnameEntry } from "../../types";
import { OpnameHistory } from "./OpnameHistory";

const DRAFT_KEY = "ugd.opnameDraft";

function loadDraft(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

interface OpnamePageProps {
  items: Item[];
  onSave: (entries: OpnameEntry[], note: string) => void;
  onBack: () => void;
}

export function OpnamePage({ items, onSave, onBack }: OpnamePageProps) {
  const [counts, setCounts] = useState<Record<string, string>>(loadDraft);
  const [scope, setScope] = useState<"darurat" | "semua" | string>("darurat");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState(false);
  const [note, setNote] = useState("");

  // Draf hitungan disimpan di HP supaya bisa dicicil dan tidak hilang bila aplikasi tertutup
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(counts));
    } catch {
      // penyimpanan tidak tersedia: draf hanya bertahan selama halaman terbuka
    }
  }, [counts]);

  const scoped = useMemo(() => {
    const base = items.filter((i) =>
      scope === "darurat" ? i.kritis : scope === "semua" ? true : i.category === scope,
    );
    return search.trim() ? searchItems(base, search) : base;
  }, [items, scope, search]);
  const { visible, rest, more, reset } = useShowMore(scoped, 40);
  // Kembali ke awal daftar setiap kali saringan berubah
  useEffect(reset, [scope, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(counts)) {
      const n = parseCount(v);
      if (n !== null && items.some((i) => i.id === id)) out[id] = n;
    }
    return out;
  }, [counts, items]);
  const entries = useMemo(() => opnameEntries(valid, items), [valid, items]);
  const diffs = entries.filter((e) => opnameDiff(e) !== 0);
  const countedInScope = scoped.filter((i) => valid[i.id] !== undefined).length;

  function clearDraft() {
    if (window.confirm("Hapus semua hitungan yang belum disimpan?")) setCounts({});
  }

  function confirmSave() {
    onSave(entries, note.trim());
    setCounts({});
    setNote("");
    setReview(false);
  }

  return (
    <>
      <button className="btn-link" onClick={onBack}>
        ← Kembali ke Pengaturan
      </button>
      <h1 className="page-title">Stok Opname</h1>
      <p className="page-sub">
        Hitung barang di rak, lalu isi jumlahnya. Hitungan tersimpan otomatis di HP ini, jadi boleh dicicil. Barang yang
        tidak diisi tidak diubah. Selisihnya dicatat sebagai <b>penyesuaian opname</b> di riwayat.
      </p>

      <div className="chips" role="group" aria-label="Barang yang dihitung">
        <button className={`chip${scope === "darurat" ? " active" : ""}`} onClick={() => setScope("darurat")}>
          Obat darurat
        </button>
        <button className={`chip${scope === "semua" ? " active" : ""}`} onClick={() => setScope("semua")}>
          Semua barang
        </button>
      </div>
      <select
        className="select-box select-inline"
        aria-label="Jenis barang"
        value={CATEGORIES.includes(scope as (typeof CATEGORIES)[number]) ? scope : ""}
        onChange={(e) => e.target.value && setScope(e.target.value)}
      >
        <option value="">Atau pilih satu jenis...</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
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
      <p className="list-label">
        Sudah dihitung {countedInScope} dari {scoped.length} barang
      </p>

      <div className="card-list">
        {visible.map((item) => {
          const raw = counts[item.id] ?? "";
          const n = parseCount(raw);
          const invalid = raw.trim() !== "" && n === null;
          const entry = n !== null ? { system: item.stock, counted: n, unit: item.unit } : null;
          return (
            <div key={item.id} className={`opname-row${entry ? (opnameDiff(entry) === 0 ? " ok" : " diff") : ""}`}>
              <div className="stock-card-main">
                <div className="stock-card-name">{item.name}</div>
                <div className="stock-card-meta">
                  Di aplikasi: <b>{item.stock}</b> {item.unit}
                </div>
                {entry && (
                  <div className={`opname-diff${opnameDiff(entry) === 0 ? " pas" : ""}`}>
                    {opnameDiff(entry) === 0 ? "✓ Pas" : `Selisih: ${diffText(entry)}`}
                  </div>
                )}
                {invalid && <div className="opname-diff">Isi angka bulat, paling sedikit 0</div>}
              </div>
              <div className="opname-input">
                <label className="form-hint" htmlFor={`op-${item.id}`}>
                  Hitung fisik
                </label>
                <input
                  id={`op-${item.id}`}
                  className="form-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="—"
                  value={raw}
                  onChange={(e) => setCounts((c) => ({ ...c, [item.id]: e.target.value }))}
                />
              </div>
            </div>
          );
        })}
      </div>
      <ShowMoreButton rest={rest} onClick={more} />

      <div className="opname-bar">
        <div>
          <b>{entries.length}</b> barang dihitung · <b>{diffs.length}</b> selisih
        </div>
        <div className="opname-bar-actions">
          {entries.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearDraft}>
              Hapus hitungan
            </button>
          )}
          <button className="btn btn-primary" disabled={entries.length === 0} onClick={() => setReview(true)}>
            Periksa & simpan
          </button>
        </div>
      </div>

      <OpnameHistory />

      {review && (
        <Modal title="Simpan Stok Opname?" onClose={() => setReview(false)}>
          <p className="page-sub">
            {entries.length} barang dihitung. {diffs.length === 0 ? "Semua pas." : `${diffs.length} barang selisih:`}
          </p>
          {diffs.length > 0 && (
            <div className="opname-review">
              {diffs.map((e) => (
                <div key={e.itemId} className="review-line">
                  <span>{e.itemName}</span>
                  <span>
                    {e.system} → {e.counted} ({diffText(e)})
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="void-explain">
            Stok barang yang selisih akan disamakan dengan hasil hitung fisik dan dicatat sebagai penyesuaian opname.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="op-note">
              Catatan (boleh dikosongkan)
            </label>
            <input
              id="op-note"
              className="form-input"
              placeholder="Contoh: Opname akhir bulan Oktober"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setReview(false)}>
              Kembali menghitung
            </button>
            <button className="btn btn-primary" onClick={confirmSave}>
              <Icon type="check" size={18} /> Simpan opname
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

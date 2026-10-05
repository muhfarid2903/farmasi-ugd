import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { emptyAllEntries } from "../../lib/opname";
import type { Item, OpnameEntry } from "../../types";

const CONFIRM_WORD = "KOSONGKAN";

interface KosongkanPageProps {
  items: Item[];
  onConfirm: (entries: OpnameEntry[]) => void;
  onBackup: () => void;
  onOpname: () => void;
  onBack: () => void;
}

/** Mengosongkan semua stok sebagai satu stok opname yang tercatat (khusus admin). */
export function KosongkanPage({ items, onConfirm, onBackup, onOpname, onBack }: KosongkanPageProps) {
  const entries = useMemo(() => emptyAllEntries(items), [items]);
  const withExpiry = useMemo(() => items.filter((i) => i.stock !== 0 && i.expiry).length, [items]);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD;

  if (done || entries.length === 0) {
    return (
      <>
        <button className="btn-link" onClick={onBack}>
          ← Kembali ke Pengaturan
        </button>
        <h1 className="page-title">Kosongkan Semua Stok</h1>
        <div className="all-good">
          <Icon type="check" size={22} /> Semua stok sudah 0.
        </div>
        <p className="page-sub kosongkan-next">
          Langkah berikutnya: hitung barang di rak, lalu isi hasilnya lewat <b>Stok Opname</b>. Hitungan bisa dicicil,
          dan setiap angka tercatat sebagai penyesuaian opname.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onOpname}>
          Mulai Stok Opname
        </button>
      </>
    );
  }

  return (
    <>
      <button className="btn-link" onClick={onBack}>
        ← Kembali ke Pengaturan
      </button>
      <h1 className="page-title">Kosongkan Semua Stok</h1>
      <p className="page-sub">
        Semua stok dijadikan 0 sebagai titik awal hitungan baru. Pengosongan dicatat sebagai satu <b>stok opname</b>,
        jadi riwayat lama tetap tersimpan dan rekap bulanan tetap seimbang.
      </p>

      <div className="alert-panel">
        <div className="alert-panel-title">
          <Icon type="alert" size={22} /> {entries.length} barang akan dijadikan 0
        </div>
        <div className="alert-row">
          <div>
            Total {entries.reduce((s, e) => s + e.system, 0).toLocaleString("id-ID")} satuan barang akan dicatat keluar
            sebagai penyesuaian opname.
            {withExpiry > 0 && ` ED pada ${withExpiry} barang ikut dikosongkan.`} Tanda obat darurat, batas minimum, dan
            data barang lain tidak berubah.
          </div>
        </div>
      </div>

      <ol className="kosongkan-steps">
        <li>
          <div className="semibold">Unduh cadangan data dulu</div>
          <p className="form-hint">Supaya angka stok lama masih bisa dilihat kalau suatu saat dibutuhkan.</p>
          <button className="btn btn-ghost" onClick={onBackup}>
            <Icon type="download" size={18} /> Buka Cadangan Data
          </button>
        </li>
        <li>
          <label className="semibold" htmlFor="kosongkan-confirm">
            Ketik <b>{CONFIRM_WORD}</b> untuk memastikan
          </label>
          <input
            id="kosongkan-confirm"
            className="form-input kosongkan-input"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
          />
        </li>
        <li>
          <button
            className="btn btn-danger btn-lg"
            disabled={!ready}
            onClick={() => {
              onConfirm(entries);
              setDone(true);
            }}
          >
            <Icon type="trash" size={20} /> Kosongkan {entries.length} barang
          </button>
        </li>
      </ol>
    </>
  );
}

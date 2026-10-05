import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { DARURAT_BELUM_ADA, DARURAT_USULAN, DATA_FIXES } from "../../data/darurat-usulan";
import { daruratDiff, hasChanges } from "../../lib/darurat";
import type { Item } from "../../types";

interface DaruratPageProps {
  items: Item[];
  onApply: (kritis: { id: string; kritis: boolean }[], units: { id: string; unit: string }[]) => void;
  onBack: () => void;
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="darurat-section">
      <button className="darurat-section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          {title} <b>({count})</b>
        </span>
        <span className="muted">{open ? "Tutup ▲" : "Lihat ▼"}</span>
      </button>
      {open && <div className="darurat-section-body">{children}</div>}
    </div>
  );
}

/** Menyesuaikan tanda "obat darurat" dengan regulasi (khusus admin). */
export function DaruratPage({ items, onApply, onBack }: DaruratPageProps) {
  const diff = useMemo(() => daruratDiff(items, DARURAT_USULAN, DATA_FIXES), [items]);
  const [confirm, setConfirm] = useState(false);
  const currentCount = items.filter((i) => i.kritis).length;
  const changed = hasChanges(diff);

  function apply() {
    onApply(
      [...diff.add.map((i) => ({ id: i.id, kritis: true })), ...diff.remove.map((i) => ({ id: i.id, kritis: false }))],
      diff.unitFixes.map((f) => ({ id: f.item.id, unit: f.unit })),
    );
    setConfirm(false);
  }

  return (
    <>
      <button className="btn-link" onClick={onBack}>
        ← Kembali ke Pengaturan
      </button>
      <h1 className="page-title">Daftar Obat Darurat</h1>
      <p className="page-sub">
        Barang bertanda <b>obat darurat</b> dipantau khusus di Beranda saat hampir habis atau mendekati kedaluwarsa.
        Usulan di bawah disusun dari regulasi yang berlaku. Keputusan akhir tetap di apoteker/dokter penanggung jawab.
      </p>

      <div className="settings-card darurat-basis">
        <div className="settings-card-title">Dasar regulasi</div>
        <ul className="guide-points">
          <li>
            <b>KMK HK.01.07/MENKES/4799/2021</b> tentang Daftar Obat Keadaan Darurat Medis: 18 obat generik (standar
            minimal).
          </li>
          <li>
            <b>Permenkes 47/2018</b> tentang Pelayanan Kegawatdaruratan, lampiran obat kategori merah/P1: sebagai
            pendukung, karena Permenkes 19/2024 tentang Puskesmas tidak memuat daftar obat darurat.
          </li>
          <li>Alat & bahan habis pakai untuk tindakan darurat: akses infus, injeksi, dan oksigen.</li>
        </ul>
      </div>

      {changed ? (
        <div className="alert-panel warn darurat-summary">
          <div className="alert-panel-title">
            <Icon type="alert" size={22} /> Daftar darurat sekarang ({currentCount}) belum sesuai usulan (
            {DARURAT_USULAN.length - diff.notFound.length})
          </div>
          <div className="alert-row">
            <div>
              Ditandai darurat: <b>{diff.add.length}</b> · Dilepas: <b>{diff.remove.length}</b> · Tetap:{" "}
              <b>{diff.keep.length}</b>
              {diff.unitFixes.length > 0 && (
                <>
                  {" "}
                  · Perbaikan satuan: <b>{diff.unitFixes.length}</b>
                </>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => setConfirm(true)}>
              <Icon type="check" size={18} /> Terapkan usulan
            </button>
          </div>
        </div>
      ) : (
        <div className="all-good">
          <Icon type="check" size={22} /> Daftar obat darurat sudah sesuai usulan regulasi ({currentCount} barang).
        </div>
      )}

      {diff.add.length > 0 && (
        <Section title="Akan ditandai darurat" count={diff.add.length}>
          {diff.add.map((i) => (
            <div key={i.id} className="review-line">
              <span>+ {i.name}</span>
              <span className="muted">{i.basis}</span>
            </div>
          ))}
        </Section>
      )}
      {diff.remove.length > 0 && (
        <Section title="Akan dilepas dari daftar darurat" count={diff.remove.length}>
          {diff.remove.map((i) => (
            <div key={i.id} className="review-line">
              <span>− {i.name}</span>
            </div>
          ))}
        </Section>
      )}
      {diff.unitFixes.length > 0 && (
        <Section title="Perbaikan satuan" count={diff.unitFixes.length}>
          {diff.unitFixes.map((f) => (
            <div key={f.item.id} className="review-line">
              <span>{f.item.name}</span>
              <span>
                {f.item.unit} → <b>{f.unit}</b>
              </span>
            </div>
          ))}
        </Section>
      )}
      <Section title={changed ? "Sudah darurat dan tetap" : "Daftar obat darurat"} count={diff.keep.length}>
        {diff.keep.map((i) => (
          <div key={i.id} className="review-line">
            <span>{i.name}</span>
            <span className="muted">{i.basis}</span>
          </div>
        ))}
      </Section>
      <Section title="Ada di regulasi tetapi belum ada di daftar barang" count={DARURAT_BELUM_ADA.length}>
        <p className="form-hint">
          Bila tersedia, tambahkan lewat Pengaturan → Tambah Barang dan centang "Obat darurat".
        </p>
        {DARURAT_BELUM_ADA.map((n) => (
          <div key={n} className="review-line">
            <span>{n}</span>
          </div>
        ))}
      </Section>

      <p className="form-hint">
        Untuk mengubah satu per satu: buka <b>Stok</b>, tekan <b>Ubah</b> pada barangnya, lalu centang atau hapus
        centang "Obat / bahan darurat".
      </p>

      {confirm && (
        <Modal title="Terapkan usulan?" onClose={() => setConfirm(false)}>
          <p className="page-sub">
            {diff.add.length} barang akan ditandai darurat, {diff.remove.length} barang dilepas
            {diff.unitFixes.length > 0 && `, dan ${diff.unitFixes.length} satuan diperbaiki`}. Jumlah obat darurat
            menjadi <b>{diff.keep.length + diff.add.length}</b>.
          </p>
          <p className="void-explain">
            Stok dan riwayat tidak berubah. Tanda darurat masih bisa diubah lagi kapan saja.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={apply}>
              <Icon type="check" size={18} /> Ya, terapkan
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

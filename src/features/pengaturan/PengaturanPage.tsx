import { Icon } from "../../components/Icon";
import type { UserProfile } from "../../types";
import { PetugasSection } from "./PetugasSection";

interface PengaturanPageProps {
  currentEmail: string;
  onSaveUser: (user: UserProfile, isNew: boolean) => void;
  onAddItem: () => void;
  onShowStock: () => void;
  onExport: () => void;
}

/** Semua fungsi khusus admin dikumpulkan di sini supaya tampilan petugas tetap sederhana. */
export function PengaturanPage({ currentEmail, onSaveUser, onAddItem, onShowStock, onExport }: PengaturanPageProps) {
  return (
    <>
      <h1 className="page-title">Pengaturan</h1>
      <p className="page-sub">Khusus admin: kelola barang, petugas, dan laporan.</p>

      <div className="settings-grid">
        <div className="settings-card">
          <Icon type="package" size={28} />
          <div className="settings-card-title">Barang</div>
          <p className="settings-card-text">
            Tambah barang baru. Untuk mengubah, menandai obat darurat, atau menghapus barang: buka <b>Stok</b>, lalu
            tekan <b>Ubah</b> pada barangnya.
          </p>
          <div className="settings-card-actions">
            <button className="btn btn-primary" onClick={onAddItem}>
              <Icon type="plus" size={18} /> Tambah Barang
            </button>
            <button className="btn btn-ghost" onClick={onShowStock}>
              Buka Stok
            </button>
          </div>
        </div>
        <div className="settings-card">
          <Icon type="download" size={28} />
          <div className="settings-card-title">Laporan</div>
          <p className="settings-card-text">Unduh catatan barang masuk dan keluar per bulan atau per tanggal.</p>
          <div className="settings-card-actions">
            <button className="btn btn-primary" onClick={onExport}>
              <Icon type="download" size={18} /> Unduh Laporan
            </button>
          </div>
        </div>
      </div>

      <PetugasSection currentEmail={currentEmail} onSave={onSaveUser} />
    </>
  );
}

import { Icon } from "../../components/Icon";
import type { UserProfile } from "../../types";
import { BackupCard } from "./BackupCard";
import { PetugasSection } from "./PetugasSection";

interface PengaturanPageProps {
  currentEmail: string;
  onSaveUser: (user: UserProfile, isNew: boolean) => void;
  onAddItem: () => void;
  onShowStock: () => void;
  onExport: () => void;
  onOpname: () => void;
  onDarurat: () => void;
  onKosongkan: () => void;
  onGabung: () => void;
  notify: (text: string, kind: "success" | "error") => void;
}

/** Semua fungsi khusus admin dikumpulkan di sini supaya tampilan petugas tetap sederhana. */
export function PengaturanPage({
  currentEmail,
  onSaveUser,
  onAddItem,
  onShowStock,
  onExport,
  onOpname,
  onDarurat,
  onKosongkan,
  onGabung,
  notify,
}: PengaturanPageProps) {
  return (
    <>
      <h1 className="page-title">Pengaturan</h1>
      <p className="page-sub">Khusus admin: kelola barang, petugas, dan laporan.</p>

      <div className="settings-grid">
        <BackupCard currentEmail={currentEmail} notify={notify} />
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
          <Icon type="package" size={28} />
          <div className="settings-card-title">Gabungkan Barang Sama</div>
          <p className="settings-card-text">
            Satukan barang yang tercatat lebih dari sekali, misalnya beda sumber dana (DAK, DAU, JKN). Stoknya
            dijumlahkan dan riwayatnya tetap tersimpan.
          </p>
          <div className="settings-card-actions">
            <button className="btn btn-primary" onClick={onGabung}>
              Buka Gabungkan Barang
            </button>
          </div>
        </div>
        <div className="settings-card">
          <Icon type="alert" size={28} />
          <div className="settings-card-title">Daftar Obat Darurat</div>
          <p className="settings-card-text">
            Sesuaikan barang bertanda obat darurat dengan regulasi (KMK 4799/2021 dan Permenkes 47/2018).
          </p>
          <div className="settings-card-actions">
            <button className="btn btn-primary" onClick={onDarurat}>
              Buka Daftar Obat Darurat
            </button>
          </div>
        </div>
        <div className="settings-card">
          <Icon type="check" size={28} />
          <div className="settings-card-title">Stok Opname</div>
          <p className="settings-card-text">
            Hitung barang di rak dan samakan dengan aplikasi. Selisihnya tercatat sebagai penyesuaian, dan riwayatnya
            tersimpan.
          </p>
          <div className="settings-card-actions">
            <button className="btn btn-primary" onClick={onOpname}>
              Mulai Stok Opname
            </button>
          </div>
        </div>
        <div className="settings-card">
          <Icon type="download" size={28} />
          <div className="settings-card-title">Laporan</div>
          <p className="settings-card-text">
            Unduh daftar catatan barang masuk/keluar, atau rekap per barang (stok awal, masuk, keluar, stok akhir) per
            bulan.
          </p>
          <div className="settings-card-actions">
            <button className="btn btn-primary" onClick={onExport}>
              <Icon type="download" size={18} /> Unduh Laporan
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card settings-card-danger">
        <Icon type="trash" size={28} />
        <div className="settings-card-title">Kosongkan Semua Stok</div>
        <p className="settings-card-text">
          Jadikan semua stok 0 sebagai awal hitungan baru. Tercatat sebagai stok opname; riwayat lama tetap tersimpan.
        </p>
        <div className="settings-card-actions">
          <button className="btn btn-danger" onClick={onKosongkan}>
            Kosongkan Semua Stok
          </button>
        </div>
      </div>

      <PetugasSection currentEmail={currentEmail} onSave={onSaveUser} />
    </>
  );
}

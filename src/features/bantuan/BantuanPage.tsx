import type { ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { APP_HOST } from "../../lib/domain";

interface BantuanPageProps {
  onShowTour: () => void;
}

function Guide({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="guide">
      <h2 className="guide-title">{title}</h2>
      {children}
    </section>
  );
}

/** Panduan pemakaian. Halaman ini juga dirancang untuk dicetak dan ditempel di dinding UGD. */
export function BantuanPage({ onShowTour }: BantuanPageProps) {
  return (
    <div className="bantuan">
      <h1 className="page-title">Bantuan</h1>
      <p className="page-sub">Cara memakai aplikasi catatan obat & bahan medis UGD.</p>
      <div className="page-actions no-print">
        <button className="btn btn-primary" onClick={onShowTour}>
          Lihat panduan singkat
        </button>
        <button className="btn btn-ghost" onClick={() => window.print()}>
          Cetak panduan ini
        </button>
      </div>

      <div className="guide-grid">
        <Guide title="Memasang aplikasi di HP">
          <p className="guide-sub">
            Alamat aplikasi: <b>{APP_HOST}</b>
          </p>
          <p className="guide-sub">
            <b>HP Android (Chrome):</b>
          </p>
          <ol className="guide-steps">
            <li>Buka alamat di atas dengan Chrome.</li>
            <li>
              Tekan <b>Masuk dengan Google</b>, pilih akun Gmail Anda.
            </li>
            <li>
              Tekan titik tiga <b>⋮</b> di kanan atas, lalu pilih <b>Instal aplikasi</b> (atau{" "}
              <b>Tambahkan ke layar utama</b>).
            </li>
            <li>
              Selanjutnya buka dari ikon <b>e-Stok UGD</b> di layar HP.
            </li>
          </ol>
          <p className="guide-sub">
            <b>iPhone (Safari):</b> tekan tombol <b>Bagikan</b> (kotak dengan panah ke atas), lalu pilih{" "}
            <b>Tambahkan ke Layar Utama</b>.
          </p>
          <p className="guide-sub">Aplikasi diperbarui sendiri, tidak perlu dipasang ulang.</p>
        </Guide>

        <Guide title="Mencatat barang keluar (dipakai pasien)">
          <ol className="guide-steps">
            <li>
              Di <b>Beranda</b>, tekan tombol oranye <b>Barang Keluar</b>.
            </li>
            <li>
              Pilih barangnya. Kalau tidak ada di daftar, ketik sebagian namanya, misalnya <b>"epi"</b> untuk Epinefrin.
            </li>
            <li>
              Isi jumlahnya dengan tombol <b>−</b> dan <b>+</b>, lalu tekan <b>Lanjut</b>.
            </li>
            <li>
              Periksa sekali lagi, pilih keterangan bila perlu, lalu tekan <b>Simpan</b>.
            </li>
          </ol>
        </Guide>

        <Guide title="Mencatat barang masuk (dari farmasi)">
          <ol className="guide-steps">
            <li>
              Di <b>Beranda</b>, tekan tombol hijau <b>Barang Masuk</b>.
            </li>
            <li>Pilih barangnya, isi jumlah yang diterima, lalu tekan Lanjut.</li>
            <li>
              Periksa, pilih keterangan <b>"Dari farmasi"</b>, lalu tekan <b>Simpan</b>.
            </li>
          </ol>
        </Guide>

        <Guide title="Salah mencatat?">
          <ul className="guide-points">
            <li>
              Tepat setelah menyimpan: tekan <b>Salah catat? Batalkan</b>.
            </li>
            <li>
              Kalau sudah lewat: buka <b>Riwayat</b>, cari catatannya, tekan <b>Batalkan</b>.
            </li>
            <li>Stok kembali seperti semula. Setelah itu catat ulang dengan jumlah yang benar.</li>
            <li>Catatan tidak bisa dihapus, supaya jejaknya tetap jelas.</li>
          </ul>
        </Guide>

        <Guide title="Tidak ada sinyal?">
          <ul className="guide-points">
            <li>
              Tetap catat seperti biasa. Di atas layar akan tertulis <b>"Tidak ada sinyal"</b>.
            </li>
            <li>
              Catatan tersimpan di HP dan terkirim sendiri saat sinyal kembali. Tulisan berubah menjadi{" "}
              <b>"Tersambung"</b>.
            </li>
            <li>Jangan keluar akun (Keluar) saat belum ada sinyal.</li>
          </ul>
        </Guide>

        <Guide title="Obat darurat hampir habis">
          <ul className="guide-points">
            <li>
              Daftarnya tampil di <b>Beranda</b> dengan kotak merah.
            </li>
            <li>Segera minta ke farmasi, lalu catat sebagai Barang Masuk saat diterima.</li>
            <li>
              Semua stok bisa dilihat di menu <b>Stok</b>.
            </li>
          </ul>
        </Guide>

        <Guide title="Tulisan terlalu kecil?">
          <ul className="guide-points">
            <li>
              Tekan tombol <b>Aa</b> di bagian atas layar, lalu pilih <b>Besar</b> atau <b>Sangat besar</b>.
            </li>
          </ul>
        </Guide>

        <Guide title="Tidak bisa masuk?">
          <ul className="guide-points">
            <li>
              Masuk dengan tombol <b>Masuk dengan Google</b> memakai akun Gmail Anda.
            </li>
            <li>
              Kalau muncul <b>"Akun belum terdaftar"</b>, minta admin UGD mendaftarkan email Anda.
            </li>
          </ul>
        </Guide>
      </div>

      <p className="guide-footer">
        <Icon type="alert" size={16} /> Ada kendala lain? Hubungi admin UGD.
      </p>
    </div>
  );
}

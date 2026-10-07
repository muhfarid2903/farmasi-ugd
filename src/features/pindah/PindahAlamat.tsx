import { useState } from "react";
import { Header } from "../../components/Header";
import { Icon } from "../../components/Icon";
import { APP_HOST, moveToNewAddress } from "../../lib/domain";

/** Layar penuh di alamat lama: aplikasi sudah pindah, satu tombol untuk membuka alamat baru. */
export function PindahAlamatScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="app">
      <Header />
      <div className="pindah-screen">
        <h1 className="page-title">Aplikasi pindah alamat</h1>
        <p className="pindah-lead">
          Mulai sekarang e-Stok UGD dibuka di alamat baru:
          <b className="pindah-host">{APP_HOST}</b>
          Data stok dan riwayat tetap sama, tidak ada yang hilang.
        </p>
        <ol className="guide-steps pindah-steps">
          <li>Tekan tombol di bawah.</li>
          <li>
            Tekan <b>Masuk dengan Google</b> dan pilih akun yang sama seperti biasa.
          </li>
          <li>
            Pasang lagi aplikasinya di layar HP (lihat menu <b>Bantuan</b>), lalu hapus ikon yang lama.
          </li>
        </ol>
        <button
          className="btn btn-primary btn-lg"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void moveToNewAddress();
          }}
        >
          Buka alamat baru
        </button>
      </div>
    </div>
  );
}

/** Pemberitahuan kecil saat masih ada catatan yang belum terkirim: pindah ditunda supaya tidak hilang. */
export function PindahAlamatBanner() {
  return (
    <div className="pindah-banner" role="status">
      <Icon type="alert" size={20} />
      <span>
        Aplikasi pindah ke alamat baru <b>{APP_HOST}</b>. Tunggu sampai ada sinyal dan semua catatan terkirim (tanda
        hijau), lalu petunjuk pindah akan muncul.
      </span>
    </div>
  );
}

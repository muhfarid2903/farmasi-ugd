import { useState } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { Modal } from "../../components/Modal";

const SLIDES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "home",
    title: "Selamat datang di e-Stok UGD!",
    text: "Aplikasi ini untuk mencatat obat dan bahan medis yang masuk dan keluar di UGD. Di Beranda ada dua tombol besar: hijau untuk Barang Masuk, oranye untuk Barang Keluar.",
  },
  {
    icon: "check",
    title: "Mencatat itu mudah",
    text: "Pilih barang, isi jumlah dengan tombol − dan +, periksa, lalu tekan Simpan. Nama Anda tercatat otomatis.",
  },
  {
    icon: "undo",
    title: "Salah catat? Tidak apa-apa",
    text: "Tekan Batalkan, stok kembali seperti semula. Tidak ada sinyal? Tetap catat saja, nanti terkirim sendiri. Panduan lengkap ada di menu Bantuan.",
  },
];

/** Panduan singkat 3 layar, muncul saat pertama kali masuk. */
export function TourModal({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <Modal title={`Panduan singkat (${i + 1} dari ${SLIDES.length})`} onClose={onClose}>
      <div className="tour-slide">
        <div className="tour-icon">
          <Icon type={slide.icon} size={40} />
        </div>
        <h2 className="tour-title">{slide.title}</h2>
        <p className="tour-text">{slide.text}</p>
      </div>
      <div className="modal-actions">
        {i > 0 ? (
          <button className="btn btn-ghost" onClick={() => setI(i - 1)}>
            ← Sebelumnya
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={onClose}>
            Lewati
          </button>
        )}
        <button className="btn btn-primary" onClick={() => (last ? onClose() : setI(i + 1))}>
          {last ? "Mulai pakai" : "Lanjut →"}
        </button>
      </div>
    </Modal>
  );
}

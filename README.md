# e-Stok UGD

Sistem rekap obat & bahan medis **UGD Puskesmas Liukang Tupabbiring, Kab. Pangkep**.

Buku stok digital untuk depo UGD: mencatat barang masuk (dari farmasi) dan keluar (dipakai pasien),
memantau stok obat & bahan emergency (kritis), dan membuat rekap bulanan. Data tersinkron real-time
ke semua perangkat petugas dan **tetap bisa dicatat saat sinyal hilang**.

## Teknologi

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org), dibangun dengan [Vite](https://vite.dev)
- [Cloud Firestore](https://firebase.google.com/docs/firestore) dengan cache offline persisten
- PWA (bisa dipasang di layar utama HP, terbuka tanpa sinyal)
- Diterbitkan otomatis ke GitHub Pages lewat GitHub Actions

## Menjalankan di komputer

Butuh Node.js 22 atau lebih baru.

```bash
npm install
npm run dev        # buka http://localhost:5173/farmasi-ugd/
```

> **Perhatian:** secara bawaan aplikasi tersambung ke database **produksi** (nilai di `.env`).
> Untuk uji coba, buat project Firebase terpisah lalu taruh konfigurasinya di `.env.local`
> (tidak ikut di-commit), dengan nama variabel yang sama seperti di `.env`.

## Perintah

| Perintah          | Fungsi                                                         |
| ----------------- | -------------------------------------------------------------- |
| `npm run dev`     | Server pengembangan                                            |
| `npm run build`   | Build produksi ke `dist/`                                      |
| `npm run preview` | Menjalankan hasil build secara lokal                           |
| `npm run check`   | Typecheck + lint + cek format + tes (sama seperti di CI)       |
| `npm test`        | Menjalankan tes                                                |
| `npm run format`  | Merapikan format kode                                          |
| `npm run icons`   | Membuat ulang ikon PWA dari `public/favicon.svg`               |
| `npm run seed`    | Mengisi daftar item awal ke project Firebase yang masih kosong |

## Struktur

```
src/
  features/
    dashboard/   ringkasan, peringatan stok kritis & menipis
    stok/        daftar item, form tambah/edit item
    transaksi/   riwayat, form barang masuk/keluar
    laporan/     ekspor rekap CSV
  components/    komponen umum (Modal, Icon, Header, ...)
  hooks/         useInventory: data real-time + status sinkron
  lib/
    stock.ts       logika stok & validasi (fungsi murni, diuji)
    repository.ts  semua baca/tulis Firestore
    firebase.ts    inisialisasi Firebase + cache offline
    csv.ts, date.ts
tests/           tes Vitest
scripts/         seed data awal
```

## Login & keamanan

- Petugas masuk dengan **akun Google**. Hanya email yang terdaftar dan aktif di koleksi `users`
  (menu **Petugas**, khusus admin) yang bisa membuka aplikasi.
- **Petugas** mencatat barang masuk/keluar dan membatalkan transaksinya sendiri. **Admin** juga
  mengelola item, membatalkan transaksi siapa pun, dan mengelola petugas.
- Transaksi **tidak bisa diubah atau dihapus**. Kesalahan dibetulkan dengan _pembatalan_: transaksi
  balik yang mengembalikan stok, sementara transaksi asli tetap tersimpan sebagai jejak.
- `firestore.rules` menegakkan semua aturan di atas di server, termasuk: stok hanya boleh berubah
  bersamaan dengan transaksi baru dan besarnya harus sama dengan jumlah transaksi itu.
  Aturan ini diuji di `rules-tests/` dan dijalankan di CI.

Mendaftarkan admin pertama (sebelum aturan keamanan diterbitkan):

```bash
npm run add-user -- nama@gmail.com "Nama Admin" admin
```

Di Firebase Console: **Authentication → Sign-in method → Google** harus aktif, dan domain
`muhfarid2903.github.io` harus ada di **Authentication → Settings → Authorized domains**.

## Cadangan data

Admin mencadangkan data dari aplikasi: **Pengaturan → Cadangan Data → Unduh cadangan sekarang**.
Hasilnya satu file JSON berisi seluruh barang, catatan transaksi, petugas, dan riwayat opname
(lengkap dengan id dokumennya). Beranda admin menampilkan pengingat bila sudah 7 hari tidak mencadangkan.

- Simpan file di tempat pribadi yang aman (Google Drive pribadi, flashdisk). File berisi email
  petugas dan catatan pasien, jadi **jangan** disimpan di repo ini, karena repo ini publik.
- Cadangan otomatis lewat GitHub Actions sengaja tidak dipakai karena alasan yang sama.
- Memulihkan dari cadangan butuh akses tingkat pemilik project (Firebase Admin SDK), sebab aturan
  keamanan melarang transaksi ditulis ulang dari aplikasi. Lakukan hanya bila benar-benar perlu.

Skrip `npm run seed` dan `npm run add-user` hanya berfungsi untuk project Firebase baru yang aturan
keamanannya belum diterbitkan.

## Deploy

Setiap push ke `main` otomatis dicek (typecheck, lint, format, tes), di-build, lalu diterbitkan ke
GitHub Pages. Kode yang gagal dicek tidak akan terbit. Di pengaturan repo, **Settings → Pages → Source**
harus diset ke **GitHub Actions**.

## Catatan desain

- **Offline lebih dulu.** Penulisan stok memakai `writeBatch` + `increment()`: tetap jalan tanpa sinyal,
  stok dan catatan transaksi tersimpan bersamaan, dan aman dari dua perangkat yang menyimpan bersamaan.
  Pengecekan "stok tidak cukup" saat offline memakai data terakhir di perangkat.
- **Peringatan stok menipis** hanya untuk item dengan minimum stok > 0.
- **Tanggal** memakai jam perangkat (WITA), bukan UTC.

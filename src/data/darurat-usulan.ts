/**
 * Usulan daftar obat & bahan darurat UGD, disusun dari:
 * - KMK HK.01.07/MENKES/4799/2021 tentang Daftar Obat Keadaan Darurat Medis (18 obat generik);
 * - Permenkes 47/2018 tentang Pelayanan Kegawatdaruratan, lampiran obat & BMHP kategori merah/P1
 *   (acuan untuk IGD; dipakai sebagai pendukung karena Permenkes 19/2024 tidak memuat daftar obat darurat).
 * Nama harus sama persis dengan nama barang di database. Keputusan akhir tetap di apoteker/dokter penanggung jawab.
 */
export interface DaruratUsulan {
  name: string;
  /** Dasar penetapan */
  basis: "KMK 4799/2021" | "PMK 47/2018" | "Alat & BMHP darurat";
}

const k = (name: string): DaruratUsulan => ({ name, basis: "KMK 4799/2021" });
const p = (name: string): DaruratUsulan => ({ name, basis: "PMK 47/2018" });
const a = (name: string): DaruratUsulan => ({ name, basis: "Alat & BMHP darurat" });

export const DARURAT_USULAN: DaruratUsulan[] = [
  // ── KMK 4799/2021 ──
  k("Epinefrin (adrenalin) inj 1 mg/ml"),
  k("Lidokain inj 2% (infiltr/p.v.)"),
  k("Atropin inj 0,25 mg/ml (i.m./i.v./s.k)"),
  k("Isosorbid dinitrat tab 5 mg"),
  k("NaCl 0,9% Larutan"),
  k("NaCl 0,9% Larutan (DAK)"),
  k("Deksametason inj 5 mg/ml (i.v./i.m.)"),
  k("Salbutamol cairan ih 1 mg/mL"),
  k("DILATAMOL CAIRAN INHALASI 2,5 ML"),
  k("Ringer Laktat Larutan (DAK)"),
  k("Ringer Laktat Larutan (DAU)"),
  k("Glukosa Larutan Infus 40%"),
  k("Diazepam inj 5 mg/ml (i.v./i.m.)"),
  k("Diazepam enema 5 mg/2,5 ml"),
  k("Diazepam enema 10 mg/2,5 ml"),
  k("Klorpromazin inj 5 mg/ml (i.m.)"),
  k("Parasetamol tts 60 mg/0,6 ml"),
  k("Propranolol tab 10 mg"),
  k("Fitomenadion (vitamin K 1) inj 2 mg/ml (i.m.)"),
  k("Fitomenadion (vitamin K1) inj 10 mg/ml (i.m)"),
  k("Magnesium sulfat inj 40%"),
  k("Nifedipin kaps 10 mg (JKN)"),
  k("Gliseril trinitrat tab 0,5 mg"),
  // ── PMK 47/2018, obat kategori merah/P1 & ruang tindakan kebidanan ──
  p("Asering"),
  p("Glukosa Larutan Infus 10% steril 500 ml"),
  p("Aminofilin inj 24 mg/ml"),
  p("Hidrokortison serb inj 100 mg"),
  p("Metilprednisolon inj 125 mg/2 ml"),
  p("Fenitoin Na inj 50 mg/ml (100 mg/ 2 mL)"),
  p("Fenobarbital Injeksi"),
  p("Furosemid inj 10 mg/ml (i.v./i.m.)"),
  p("Manitol lar infus 20%"),
  p("Norepinefrin inj 1 mg/ml"),
  p("Serum antitetanus (A.T.S) inj 1500 UI/amp (i.m.)"),
  p("Human tetanus imunoglobulin inj 250 UI (i.m.)"),
  p("Oksitosin inj 10 UI/ml"),
  p("Difenhidramin inj 10 mg/ml (i.v./i.m.)"),
  p("Oksigen ih, gas dlm tabung"),
  // ── Alat & BMHP untuk tindakan darurat (akses infus, injeksi, oksigen) ──
  a("I.V. Catheter No. 18"),
  a("I.V. Catheter No. 20"),
  a("I.V. Catheter No. 22"),
  a("I.V. Catheter No. 24"),
  a("I.V. Catheter No. 26 (JKN)"),
  a("Infusion set dewasa"),
  a("Infusion set anak"),
  a("Infusion Set Anak ( DAU)"),
  a("Alat suntik sekali pakai 1 ml"),
  a("Alat suntik sekali pakai 3 ml"),
  a("Alat suntik sekali pakai 5 ml"),
  a("Alat suntik sekali pakai 5 ml (P2PL)"),
  a("Alat suntik sekali pakai 5 ml( DAK )"),
  a("Alat suntik sekali pakai 10 ml"),
  a("Alat Suntik 10 ml Syrnge"),
  a("Air untuk injeksi amp 20 ml"),
  a("Air untuk injeksi amp 25 ml"),
  a("Nasal Oksigen Dewasa"),
  a("Nasal Oksigen Anak"),
  a("Nasal Oksigen Bayi"),
  a("Masker oksigen dewasa"),
  a("Masker oksigen anak"),
];

/** Obat dalam KMK 4799/2021 yang belum ada di daftar barang UGD (perlu ditambahkan admin bila tersedia). */
export const DARURAT_BELUM_ADA = [
  "Ketoprofen supp 100 mg (KMK 4799/2021)",
  "Parasetamol supp 80 mg dan 125 mg (KMK 4799/2021)",
  "Propranolol inj 1 mg/mL (KMK 4799/2021)",
  "Isosorbid dinitrat tab 10 mg (KMK 4799/2021)",
  "Cairan infus koloid (PMK 47/2018, kategori merah)",
];

/** Perbaikan data yang ikut diterapkan bersama usulan. */
export const DATA_FIXES: { name: string; unit: string; reason: string }[] = [
  {
    name: "Fitomenadion (vitamin K1) inj 10 mg/ml (i.m)",
    unit: "ampul",
    reason: "Sediaan injeksi tercatat bersatuan tablet",
  },
];

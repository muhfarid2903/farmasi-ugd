import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Konfigurasi web Firebase bersifat publik (bukan rahasia); keamanan data diatur oleh Firestore Security Rules.
// Nilainya diambil dari file .env agar project uji coba dan produksi bisa dipisah.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// Sesi login tersimpan di perangkat, jadi petugas tetap masuk walau aplikasi dibuka tanpa sinyal.
export const auth = getAuth(app);

// Cache lokal persisten: data tetap tampil dan transaksi tetap bisa dicatat saat sinyal hilang,
// lalu otomatis terkirim ke server begitu koneksi kembali.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

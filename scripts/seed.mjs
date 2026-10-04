// Isi koleksi `items` dengan daftar awal dari seed-items.json.
// Hanya untuk project Firebase yang masih kosong (mis. project uji coba baru).
//
//   npm run seed            → batal jika koleksi items sudah berisi
//   npm run seed -- --force → tetap tambahkan (bisa membuat data ganda!)
//
// Membaca konfigurasi dari .env.local jika ada, lalu .env.
import { existsSync, readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, limit, query, writeBatch } from "firebase/firestore";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const env = (k) => process.env[`VITE_FIREBASE_${k}`];
const app = initializeApp({
  apiKey: env("API_KEY"),
  authDomain: env("AUTH_DOMAIN"),
  projectId: env("PROJECT_ID"),
  appId: env("APP_ID"),
});
const db = getFirestore(app);
const items = JSON.parse(readFileSync(new URL("./seed-items.json", import.meta.url), "utf8"));

const existing = await getDocs(query(collection(db, "items"), limit(1)));
if (!existing.empty && !process.argv.includes("--force")) {
  console.error(`Koleksi items di project "${env("PROJECT_ID")}" sudah berisi data. Dibatalkan.`);
  process.exit(1);
}

const createdAt = new Date().toISOString();
// Firestore membatasi 500 operasi per batch
for (let i = 0; i < items.length; i += 450) {
  const batch = writeBatch(db);
  for (const it of items.slice(i, i + 450)) batch.set(doc(collection(db, "items")), { ...it, createdAt });
  await batch.commit();
}
console.log(`${items.length} item ditambahkan ke project "${env("PROJECT_ID")}".`);
process.exit(0);

// Daftarkan petugas/admin langsung ke database. Dipakai untuk admin pertama, sebelum aturan keamanan
// diaktifkan; setelah itu petugas didaftarkan dari menu Petugas di aplikasi.
//
//   node scripts/add-user.mjs <email> "<nama>" [admin|petugas]
import { existsSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const [rawEmail, name, role = "petugas"] = process.argv.slice(2);
if (!rawEmail || !name || !["admin", "petugas"].includes(role)) {
  console.error('Pemakaian: node scripts/add-user.mjs <email> "<nama>" [admin|petugas]');
  process.exit(1);
}

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const env = (k) => process.env[`VITE_FIREBASE_${k}`];
const db = getFirestore(initializeApp({ apiKey: env("API_KEY"), projectId: env("PROJECT_ID"), appId: env("APP_ID") }));

const email = rawEmail.trim().toLowerCase();
await setDoc(doc(db, "users", email), { name, role, active: true, createdAt: new Date().toISOString() });
console.log(`${name} <${email}> terdaftar sebagai ${role} di project "${env("PROJECT_ID")}".`);
process.exit(0);

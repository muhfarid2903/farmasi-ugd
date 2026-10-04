// Cadangkan seluruh koleksi items & transactions ke backups/backup-<waktu>.json (hanya membaca).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const env = (k) => process.env[`VITE_FIREBASE_${k}`];
const db = getFirestore(initializeApp({ apiKey: env("API_KEY"), projectId: env("PROJECT_ID"), appId: env("APP_ID") }));

const dump = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));
const data = {
  project: env("PROJECT_ID"),
  takenAt: new Date().toISOString(),
  items: await dump("items"),
  transactions: await dump("transactions"),
};

mkdirSync("backups", { recursive: true });
const file = `backups/backup-${data.takenAt.replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(data, null, 1));
console.log(`${data.items.length} item, ${data.transactions.length} transaksi → ${file}`);
process.exit(0);

// Jalankan rencana penggabungan item ganda dari backups/plan.json.
//
//   node scripts/dedupe-apply.mjs backups/plan.json                       → uji coba, tidak menulis
//   node scripts/dedupe-apply.mjs backups/plan.json --execute             → tulis ke database
//   ... --counts backups/daftar-hitung-fisik.csv                          → sertakan hasil hitung fisik
//
// Grup yang stoknya berbeda hanya diproses jika hasil hitung fisiknya ada di file --counts.
// Sebelum menulis, data di server dicocokkan dengan cadangan; jika ada yang berubah, dibatalkan.
import { existsSync, readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, writeBatch } from "firebase/firestore";

const args = process.argv.slice(2);
const plan = JSON.parse(readFileSync(args[0], "utf8"));
const execute = args.includes("--execute");
const countsFile = args.includes("--counts") ? args[args.indexOf("--counts") + 1] : null;

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const env = (k) => process.env[`VITE_FIREBASE_${k}`];
if (env("PROJECT_ID") !== plan.project)
  throw new Error(`Project ${env("PROJECT_ID")} ≠ project rencana ${plan.project}`);
const db = getFirestore(initializeApp({ apiKey: env("API_KEY"), projectId: env("PROJECT_ID"), appId: env("APP_ID") }));

// Hasil hitung fisik: CSV dengan kolom "Nama Item" dan "Hasil hitung fisik"
const counts = new Map();
if (countsFile) {
  // Pembaca satu baris CSV: mendukung sel berkutip, koma di dalam kutip, dan sel kosong
  const parseRow = (line) => {
    const cells = [""];
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') ((cells[cells.length - 1] += '"'), i++);
      else if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) cells.push("");
      else cells[cells.length - 1] += ch;
    }
    return cells;
  };
  const [header, ...rows] = readFileSync(countsFile, "utf8")
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map(parseRow);
  const ni = header.indexOf("Nama Item"),
    ci = header.indexOf("Hasil hitung fisik");
  for (const r of rows) {
    if (r[ci]?.trim() === "") continue;
    const n = Number(r[ci]);
    if (!Number.isInteger(n) || n < 0) throw new Error(`Hasil hitung tidak valid untuk "${r[ni]}": ${r[ci]}`);
    counts.set(r[ni].trim().toLowerCase(), n);
  }
}

// Cocokkan kondisi server saat ini dengan cadangan
const items = new Map((await getDocs(collection(db, "items"))).docs.map((d) => [d.id, d.data()]));
const txs = (await getDocs(collection(db, "transactions"))).docs.map((d) => ({ id: d.id, ...d.data() }));
const problems = [];
for (const m of plan.merges) {
  for (const c of m.copies) {
    const cur = items.get(c.id);
    if (!cur) problems.push(`${m.name}: salinan ${c.id} sudah tidak ada`);
    else if (cur.stock !== c.stock || cur.minStock !== c.minStock || !!cur.kritis !== c.kritis)
      problems.push(`${m.name}: berubah sejak dicadangkan (stok ${c.stock}→${cur.stock})`);
    const txNow = txs.filter((t) => t.itemId === c.id).length;
    if (txNow !== c.tx) problems.push(`${m.name}: ada transaksi baru (${c.tx}→${txNow})`);
  }
}
if (problems.length) {
  console.error(
    "Dibatalkan, data berubah sejak dicadangkan. Ambil cadangan & rencana baru dulu:\n  " + problems.join("\n  "),
  );
  process.exit(1);
}

const ops = [];
let merged = 0,
  skipped = 0,
  removed = 0,
  moved = 0;
for (const m of plan.merges) {
  const update = { ...m.update };
  if (m.needsCount) {
    const n = counts.get(m.name.trim().toLowerCase());
    if (n === undefined) {
      skipped++;
      continue;
    }
    update.stock = n;
  }
  ops.push((b) => b.update(doc(db, "items", m.keepId), update));
  for (const id of m.moveTxIds)
    ops.push((b) => b.update(doc(db, "transactions", id), { itemId: m.keepId, itemName: m.name }));
  for (const id of m.removeIds) ops.push((b) => b.delete(doc(db, "items", id)));
  merged++;
  removed += m.removeIds.length;
  moved += m.moveTxIds.length;
}

console.log(`${merged} grup digabung, ${removed} salinan dihapus, ${moved} transaksi dipindah.`);
console.log(
  `${skipped} grup dilewati (menunggu hasil hitung fisik). Item tersisa setelahnya: ${items.size - removed}.`,
);
if (!execute) {
  console.log("Uji coba saja, tidak ada yang ditulis. Tambahkan --execute untuk menjalankan.");
  process.exit(0);
}
for (let i = 0; i < ops.length; i += 400) {
  const b = writeBatch(db);
  ops.slice(i, i + 400).forEach((op) => op(b));
  await b.commit();
}
console.log(`Selesai: ${ops.length} operasi ditulis.`);
process.exit(0);

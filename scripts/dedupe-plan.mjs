// Analisis item ganda dari file cadangan dan susun rencana penggabungan (TIDAK menulis ke database).
//
//   node scripts/dedupe-plan.mjs backups/backup-xxx.json backups/plan.json
//
// Aturan:
// - Item dikelompokkan berdasarkan nama (tanpa beda huruf besar/kecil & spasi di tepi).
// - Item yang dipertahankan: yang transaksinya paling baru; jika tidak ada, yang paling lama dibuat.
// - Semua transaksi salinan lain dipindah ke item yang dipertahankan; salinan lain dihapus.
// - Kritis = kritis jika salah satu salinan kritis; minimum stok = yang terbesar (lebih aman untuk UGD).
// - Stok: jika semua salinan sama → dipakai. Jika berbeda → TIDAK ditebak; item masuk daftar hitung fisik
//   dan stoknya baru diisi setelah ada hasil hitung.
import { readFileSync, writeFileSync } from "node:fs";

const [backupFile, outFile] = process.argv.slice(2);
const backup = JSON.parse(readFileSync(backupFile, "utf8"));
const key = (s) => s.trim().toLowerCase();

const txBy = new Map();
for (const t of backup.transactions) txBy.set(t.itemId, [...(txBy.get(t.itemId) ?? []), t]);
const lastActivity = (i) =>
  (txBy.get(i.id) ?? [])
    .map((t) => t.createdAt)
    .sort()
    .at(-1) ?? "";

const groups = new Map();
for (const i of backup.items) groups.set(key(i.name), [...(groups.get(key(i.name)) ?? []), i]);

const merges = [];
for (const g of groups.values()) {
  if (g.length < 2) continue;
  const keep = [...g].sort(
    (a, b) => lastActivity(b).localeCompare(lastActivity(a)) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  )[0];
  const stocks = [...new Set(g.map((i) => i.stock))];
  merges.push({
    name: keep.name,
    keepId: keep.id,
    removeIds: g.filter((i) => i !== keep).map((i) => i.id),
    moveTxIds: g.filter((i) => i !== keep).flatMap((i) => (txBy.get(i.id) ?? []).map((t) => t.id)),
    update: {
      kritis: g.some((i) => i.kritis),
      minStock: Math.max(...g.map((i) => i.minStock)),
      ...(stocks.length === 1 ? {} : { stock: null }), // null = menunggu hasil hitung fisik
    },
    needsCount: stocks.length > 1,
    copies: g.map((i) => ({
      id: i.id,
      stock: i.stock,
      minStock: i.minStock,
      kritis: !!i.kritis,
      category: i.category,
      unit: i.unit,
      createdAt: i.createdAt,
      tx: txBy.get(i.id)?.length ?? 0,
      lastTx: lastActivity(i) || null,
    })),
  });
}

const plan = { backupFile, project: backup.project, backupTakenAt: backup.takenAt, merges };
writeFileSync(outFile, JSON.stringify(plan, null, 1));
const count = merges.filter((m) => m.needsCount);
console.log(`${merges.length} grup ganda, ${merges.reduce((s, m) => s + m.removeIds.length, 0)} salinan akan dihapus,`);
console.log(
  `${merges.reduce((s, m) => s + m.moveTxIds.length, 0)} transaksi dipindah, ${count.length} item perlu dihitung fisik.`,
);

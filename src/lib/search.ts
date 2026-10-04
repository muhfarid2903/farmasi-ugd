import type { Item, Transaction } from "../types";

/**
 * Sebutan sehari-hari di UGD → kata yang dipakai di nama item.
 * Pencarian dengan kata di kiri juga mencari kata di kanan.
 */
const SYNONYMS: Record<string, string[]> = {
  adrenalin: ["epinefrin"],
  spuit: ["alat suntik"],
  spet: ["alat suntik"],
  suntikan: ["alat suntik"],
  abocath: ["i.v. catheter"],
  iv: ["i.v. catheter"],
  infus: ["infusion", "larutan"],
  rl: ["ringer laktat"],
  ringer: ["ringer laktat"],
  garam: ["nacl"],
  "sarung tangan": ["handscoon", "glove"],
  handscun: ["handscoon"],
  kateter: ["catheter"],
  oksigen: ["oksigen", "nasal"],
  benang: ["catgut", "silk"],
  plester: ["plester", "hypafix", "dermafix"],
  kasa: ["kasa"],
  parasetamol: ["parasetamol", "paracetamol"],
  paracetamol: ["parasetamol"],
};

/** Huruf kecil, tanpa tanda baca, spasi tunggal. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Jarak edit (Levenshtein) dengan batas: berhenti lebih awal jika melebihi `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Apakah satu kata pencarian cocok dengan nama: awal kata, bagian kata, atau salah ketik sedikit. */
function wordScore(word: string, nameWords: string[], name: string): number {
  if (nameWords.some((w) => w.startsWith(word))) return 3;
  if (name.includes(word)) return 2;
  // Toleransi salah ketik: 1 huruf untuk kata 4–6 huruf, 2 huruf untuk kata lebih panjang
  const max = word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0;
  if (max > 0 && nameWords.some((w) => editDistance(word, w.slice(0, word.length + max), max) <= max)) return 1;
  return 0;
}

/** Skor kecocokan item dengan teks pencarian; 0 berarti tidak cocok. */
export function matchScore(query: string, itemName: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(itemName);
  const nameWords = name.split(" ");

  // Sinonim: jika seluruh pencarian adalah sebutan sehari-hari, cocokkan juga nama aslinya
  for (const target of SYNONYMS[q] ?? []) {
    if (name.includes(normalize(target))) return 10;
  }

  let total = 0;
  for (const word of q.split(" ")) {
    const alt = (SYNONYMS[word] ?? []).map(normalize);
    const s = Math.max(wordScore(word, nameWords, name), ...alt.map((a) => (name.includes(a) ? 3 : 0)));
    if (s === 0) return 0; // semua kata harus cocok
    total += s;
  }
  // Nama yang diawali pencarian ditaruh paling atas
  return total + (name.startsWith(q) ? 5 : 0);
}

/** Cari item, diurutkan dari yang paling cocok; bila sama, yang sering dipakai lebih dulu. */
export function searchItems(items: Item[], query: string, usage: Map<string, number> = new Map()): Item[] {
  return items
    .map((item) => ({ item, score: matchScore(query, item.name) }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (usage.get(b.item.id) ?? 0) - (usage.get(a.item.id) ?? 0) ||
        a.item.name.localeCompare(b.item.name),
    )
    .map((r) => r.item);
}

/** Berapa kali tiap item dipakai dalam transaksi sejak tanggal tertentu (pembatalan tidak dihitung). */
export function itemUsage(transactions: Transaction[], sinceDate: string): Map<string, number> {
  const usage = new Map<string, number>();
  for (const t of transactions) {
    if (t.date < sinceDate || t.voidedBy || t.voidsTxId) continue;
    usage.set(t.itemId, (usage.get(t.itemId) ?? 0) + 1);
  }
  return usage;
}

/** Item yang paling sering dipakai; jika riwayat masih sedikit, dilengkapi item kritis yang ada stoknya. */
export function frequentItems(items: Item[], usage: Map<string, number>, limit = 8): Item[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const result = [...usage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id))
    .filter((i): i is Item => !!i)
    .slice(0, limit);
  if (result.length < limit) {
    const extra = items
      .filter((i) => i.kritis && i.stock > 0 && !result.includes(i))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, limit - result.length);
    result.push(...extra);
  }
  return result;
}

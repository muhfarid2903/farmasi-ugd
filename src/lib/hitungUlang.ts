import type { Item, OpnameEntry, Transaction } from "../types";

/**
 * "Jadikan hitung fisik": hasil hitung ulang stok yang terlanjur dicatat sebagai barang masuk.
 * Tiap catatan masuk dibatalkan, lalu jumlahnya dicatat ulang sebagai penyesuaian stok opname,
 * sehingga stok tidak berubah tetapi LPLPO tidak lagi menghitungnya sebagai penerimaan dari farmasi.
 */

/** Catatan barang masuk pada tanggal itu yang bisa dijadikan hitung fisik, urut waktu catat. */
export function hitungUlangCandidates(transactions: Transaction[], items: Item[], date: string): Transaction[] {
  const active = new Set(items.map((i) => i.id));
  return transactions
    .filter(
      (t) =>
        t.date === date &&
        t.type === "masuk" &&
        !t.adjust &&
        !t.voidedBy &&
        !t.voidsTxId &&
        // Barang yang sudah digabung/dihapus: stoknya sudah pindah, jangan dibatalkan lagi
        active.has(t.itemId),
    )
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/** Tanggal terakhir di bulan `today` yang punya catatan untuk dijadikan hitung fisik; selain itu hari ini. */
export function defaultHitungUlangDate(transactions: Transaction[], items: Item[], today: string): string {
  const dates = new Set(transactions.filter((t) => t.date.startsWith(today.slice(0, 7))).map((t) => t.date));
  const withCandidates = [...dates]
    .filter((d) => d <= today && hitungUlangCandidates(transactions, items, d).length > 0)
    .sort();
  return withCandidates.at(-1) ?? today;
}

export interface HitungUlangPlan {
  /**
   * Putaran pembatalan. Aturan keamanan hanya membolehkan satu transaksi per barang dalam satu batch,
   * jadi barang yang punya dua catatan masuk dibatalkan dalam dua putaran.
   */
  voidRounds: Transaction[][];
  /** Satu baris per barang untuk dokumen opname: `system` = stok tanpa catatan masuk itu, `counted` = stok sekarang. */
  entries: OpnameEntry[];
}

export function hitungUlangPlan(selected: Transaction[], items: Item[]): HitungUlangPlan {
  const voidRounds: Transaction[][] = [];
  const perItem = new Map<string, number>();
  for (const t of selected) {
    const seen = perItem.get(t.itemId) ?? 0;
    (voidRounds[seen] ??= []).push(t);
    perItem.set(t.itemId, seen + 1);
  }
  const entries: OpnameEntry[] = [];
  for (const id of perItem.keys()) {
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    const qty = selected.filter((t) => t.itemId === id).reduce((s, t) => s + t.qty, 0);
    entries.push({ itemId: id, itemName: item.name, unit: item.unit, system: item.stock - qty, counted: item.stock });
  }
  entries.sort((a, b) => a.itemName.localeCompare(b.itemName));
  return { voidRounds, entries };
}

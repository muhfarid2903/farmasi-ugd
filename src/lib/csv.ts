import type { Transaction } from "../types";

/** Escape satu sel CSV: bungkus dengan kutip ganda dan gandakan kutip di dalamnya. */
export function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildRecapCSV(txs: Transaction[], periodLabel: string, exportedAt: Date = new Date()): string {
  const masuk = txs.filter((t) => t.type === "masuk").length;
  const keluar = txs.length - masuk;
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const lines = [
    "REKAP TRANSAKSI UGD PUSKESMAS L. TUPABBIRING",
    csvCell(`Periode: ${periodLabel}`),
    csvCell(`Total Transaksi: ${txs.length} (Masuk: ${masuk} | Keluar: ${keluar})`),
    csvCell(`Diekspor: ${exportedAt.toLocaleString("id-ID")}`),
    "",
    "No,Tanggal,Item,Tipe,Jumlah,Keterangan,Petugas",
    ...sorted.map((t, i) =>
      [i + 1, t.date, t.itemName, t.type === "masuk" ? "Masuk" : "Keluar", t.qty, t.note ?? "", t.operator]
        .map(csvCell)
        .join(","),
    ),
  ];
  return lines.join("\n") + "\n";
}

/** Unduh teks sebagai file. BOM ditambahkan agar Excel membaca UTF-8 dengan benar. */
export function downloadText(content: string, filename: string): void {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

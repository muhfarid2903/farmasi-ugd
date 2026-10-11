/// <reference types="node" />
import { readFileSync } from "node:fs";

/** File stok opname contoh berisi data rekaan, dibuat dengan openpyxl (dipadatkan, memakai shared strings). */
export function contohXlsx(): ArrayBuffer {
  const b = readFileSync(new URL("./stok-opname-contoh.xlsx", import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

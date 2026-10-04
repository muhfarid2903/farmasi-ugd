import { useEffect, useState } from "react";

export const FONT_SCALES = [
  { value: 1, label: "Normal" },
  { value: 1.15, label: "Besar" },
  { value: 1.3, label: "Sangat besar" },
] as const;

const KEY = "ugd.fontScale";

function readScale(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return FONT_SCALES.some((s) => s.value === v) ? v : 1;
  } catch {
    return 1;
  }
}

/** Ukuran huruf pilihan petugas, tersimpan di perangkat ini. */
export function useFontScale() {
  const [scale, setScale] = useState(readScale);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(scale));
    try {
      localStorage.setItem(KEY, String(scale));
    } catch {
      // Penyimpanan tidak tersedia (mis. mode penyamaran): pilihan tetap berlaku sampai halaman ditutup
    }
  }, [scale]);

  return [scale, setScale] as const;
}

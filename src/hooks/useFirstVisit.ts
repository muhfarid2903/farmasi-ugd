import { useCallback, useState } from "react";

/** true jika pengguna ini belum pernah melihat sesuatu (mis. panduan singkat) di perangkat ini. */
export function useFirstVisit(key: string) {
  const storageKey = `ugd.seen.${key}`;
  const [first, setFirst] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === null;
    } catch {
      return false; // penyimpanan tidak tersedia: jangan tampilkan berulang-ulang
    }
  });
  const markSeen = useCallback(() => {
    setFirst(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // abaikan
    }
  }, [storageKey]);
  return [first, markSeen] as const;
}

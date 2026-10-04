import { useCallback, useEffect, useRef } from "react";

/**
 * Tombol "Kembali" di HP (dan browser) menutup lapisan yang sedang terbuka (dialog, langkah catat barang),
 * bukannya keluar dari aplikasi.
 *
 * Saat lapisan dibuka, satu entri riwayat ditambahkan. Menekan Kembali memanggil `onBack`:
 * kembalikan `true` jika lapisan tetap terbuka (mis. mundur satu langkah), atau tutup lapisannya.
 * Tutup lewat tombol di layar dengan `requestClose()`, agar entri riwayatnya ikut dibersihkan.
 */
export function useBackButton(onBack: () => boolean | void) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    const id = Math.random().toString(36).slice(2);
    let poppedByBack = false;
    history.pushState({ ugdLayer: id }, "");

    const onPop = () => {
      if (onBackRef.current()) {
        history.pushState({ ugdLayer: id }, ""); // tetap terbuka: pasang lagi entrinya
      } else {
        poppedByBack = true;
      }
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (poppedByBack) return;
      // Ditutup dari dalam aplikasi: hapus entri riwayatnya, kecuali sudah ada lapisan baru di atasnya
      setTimeout(() => {
        if (history.state?.ugdLayer === id) history.back();
      }, 0);
    };
  }, []);

  return useCallback(() => history.back(), []);
}

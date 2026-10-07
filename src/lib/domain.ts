/** Alamat resmi aplikasi. */
export const APP_HOST = "ugd.balanglompo.com";
export const APP_URL = `https://${APP_HOST}/`;

/** Alamat lama sebelum pindah domain. Aplikasi yang terpasang dari sini tidak bisa diperbarui lagi setelah pindah. */
const OLD_HOSTS = ["muhfarid2903.github.io"];

export function onOldAddress(host = location.hostname): boolean {
  return OLD_HOSTS.includes(host);
}

/** true jika aplikasi sudah bisa dibuka di alamat baru (manifest-nya terbaca). */
export async function newAddressReady(): Promise<boolean> {
  try {
    const res = await fetch(`${APP_URL}manifest.webmanifest`, { cache: "no-store" });
    if (!res.ok) return false;
    const manifest = (await res.json()) as { short_name?: string };
    return manifest.short_name === "e-Stok UGD";
  } catch {
    return false; // belum aktif, sertifikat belum terbit, atau tidak ada sinyal
  }
}

/**
 * Pindah ke alamat baru. Service worker alamat lama dilepas dulu supaya ikon lama di HP
 * tidak terus membuka versi lama dari cache, tetapi diarahkan ke alamat baru.
 */
export async function moveToNewAddress(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // abaikan: tetap pindah
  }
  location.replace(APP_URL);
}

import { useEffect, useState } from "react";
import { newAddressReady, onOldAddress } from "../lib/domain";

const CHECK_EVERY_MS = 15 * 60 * 1000;

/** true jika aplikasi ini dibuka dari alamat lama dan alamat baru sudah aktif. */
export function useNewAddress(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!onOldAddress()) return;
    let active = true;
    const check = () =>
      newAddressReady().then((ok) => {
        if (active && ok) setReady(true);
      });
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("online", check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", check);
    };
  }, []);
  return ready;
}

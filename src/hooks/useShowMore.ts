import { useState } from "react";

/** Tampilkan daftar panjang sedikit demi sedikit agar HP tetap ringan. */
export function useShowMore<T>(list: T[], step = 30) {
  const [limit, setLimit] = useState(step);
  return {
    visible: list.slice(0, limit),
    rest: Math.max(0, list.length - limit),
    more: () => setLimit((l) => l + step),
    reset: () => setLimit(step),
  };
}

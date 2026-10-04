import type { SyncStatus } from "../types";

const LABELS: Record<SyncStatus, { cls: string; dot: string; label: string; title: string }> = {
  loading: { cls: "sync-loading", dot: "loading", label: "Memuat", title: "Menghubungkan ke database" },
  online: { cls: "sync-online", dot: "online", label: "Real-time", title: "Tersambung dan tersinkron" },
  pending: {
    cls: "sync-loading",
    dot: "loading",
    label: "Menyinkronkan",
    title: "Ada perubahan yang belum terkirim ke server",
  },
  offline: {
    cls: "sync-offline",
    dot: "offline",
    label: "Offline",
    title: "Tidak ada sinyal. Data tetap bisa dicatat dan akan terkirim otomatis.",
  },
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  const s = LABELS[status];
  return (
    <div className={`sync-badge ${s.cls}`} title={s.title}>
      <div className={`sync-dot ${s.dot}`} />
      {s.label}
    </div>
  );
}

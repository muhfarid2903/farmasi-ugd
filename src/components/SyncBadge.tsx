import type { SyncStatus } from "../types";
import { Icon } from "./Icon";

const LABELS: Record<SyncStatus, { cls: string; label: string; title: string }> = {
  loading: { cls: "sync-loading", label: "Menyambungkan...", title: "Sedang menyambung ke server" },
  online: { cls: "sync-online", label: "Tersambung", title: "Semua catatan sudah terkirim" },
  pending: {
    cls: "sync-loading",
    label: "Mengirim...",
    title: "Catatan sedang dikirim ke server",
  },
  offline: {
    cls: "sync-offline",
    label: "Tidak ada sinyal",
    title: "Catatan tetap tersimpan di HP ini dan terkirim otomatis saat ada sinyal",
  },
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  const s = LABELS[status];
  return (
    <div className={`sync-badge ${s.cls}`} title={s.title} role="status">
      <Icon type={status === "online" ? "check" : "wifi"} size={16} />
      {s.label}
    </div>
  );
}

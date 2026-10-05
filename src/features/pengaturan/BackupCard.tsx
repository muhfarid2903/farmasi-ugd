import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { backupDue, backupFilename, buildBackup, daysSince } from "../../lib/backup";
import { downloadText } from "../../lib/csv";
import { fetchAllForBackup, setBackupMeta, subscribeBackupMeta, type BackupMeta } from "../../lib/repository";

interface BackupCardProps {
  currentEmail: string;
  notify: (text: string, kind: "success" | "error") => void;
}

function lastText(meta: BackupMeta | null): string {
  const d = daysSince(meta?.lastBackupAt ?? null);
  if (d === null) return "Belum pernah dicadangkan.";
  const when = d === 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`;
  return `Cadangan terakhir: ${when} oleh ${meta!.by}.`;
}

/** Unduh seluruh data sebagai satu file cadangan (khusus admin). */
export function BackupCard({ currentEmail, notify }: BackupCardProps) {
  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeBackupMeta(setMeta), []);

  async function handleBackup() {
    setBusy(true);
    try {
      const data = await fetchAllForBackup();
      const backup = buildBackup(data, { project: import.meta.env.VITE_FIREBASE_PROJECT_ID, takenBy: currentEmail });
      downloadText(JSON.stringify(backup, null, 1), backupFilename(), "application/json");
      await setBackupMeta({ lastBackupAt: backup.takenAt, by: currentEmail });
      notify(
        `Cadangan diunduh: ${backup.counts.items} barang, ${backup.counts.transactions} catatan. Simpan file-nya di tempat aman.`,
        "success",
      );
    } catch (e) {
      console.error(e);
      notify(
        navigator.onLine
          ? `Cadangan gagal dibuat: ${(e as Error).message}`
          : "Cadangan butuh sinyal internet. Coba lagi saat tersambung.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const due = backupDue(meta?.lastBackupAt ?? null);
  return (
    <div className={`settings-card${due ? " settings-card-warn" : ""}`}>
      <Icon type="download" size={28} />
      <div className="settings-card-title">Cadangan Data</div>
      <p className="settings-card-text">
        {lastText(meta)} Unduh cadangan <b>setiap minggu</b>, lalu simpan file-nya di tempat aman (mis. Google Drive
        pribadi atau flashdisk). File berisi data petugas dan catatan pasien, <b>jangan dibagikan</b>.
      </p>
      <div className="settings-card-actions">
        <button className="btn btn-primary" onClick={handleBackup} disabled={busy}>
          <Icon type="download" size={18} /> {busy ? "Menyiapkan cadangan..." : "Unduh cadangan sekarang"}
        </button>
      </div>
    </div>
  );
}

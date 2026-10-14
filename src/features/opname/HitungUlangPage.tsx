import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { formatDate } from "../../lib/date";
import {
  defaultHitungUlangDate,
  hitungUlangCandidates,
  hitungUlangPlan,
  mergedTargetName,
  type HitungUlangPlan,
} from "../../lib/hitungUlang";
import type { Item, Transaction } from "../../types";

type Step = () => Promise<void>;

type RunState =
  | { kind: "idle" }
  | { kind: "running"; steps: Step[]; at: number; count: number }
  | { kind: "failed"; steps: Step[]; at: number; count: number; message: string }
  | { kind: "done"; count: number };

interface HitungUlangPageProps {
  /** Termasuk barang yang sudah digabung. */
  allItems: Item[];
  transactions: Transaction[];
  today: string;
  /** Tersambung ke server tanpa catatan yang tertunda. */
  online: boolean;
  makeSteps: (plan: HitungUlangPlan, date: string) => Step[];
  onLplpo: () => void;
  onBack: () => void;
}

function timeOf(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `pukul ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Hasil hitung ulang stok yang terlanjur dicatat sebagai Barang Masuk dijadikan stok opname (khusus admin).
 * Stok tidak berubah; di LPLPO angkanya pindah dari Penerimaan ke Stok Awal.
 */
export function HitungUlangPage({
  allItems,
  transactions,
  today,
  online,
  makeSteps,
  onLplpo,
  onBack,
}: HitungUlangPageProps) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [date, setDate] = useState(() => defaultHitungUlangDate(transactions, allItems, today));
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [run, setRun] = useState<RunState>({ kind: "idle" });

  const candidates = useMemo(() => hitungUlangCandidates(transactions, allItems, date), [transactions, allItems, date]);
  const selected = candidates.filter((t) => !skipped.has(t.id));
  const itemCount = new Set(selected.map((t) => t.itemId)).size;
  const unitOf = (id: string) => allItems.find((i) => i.id === id)?.unit ?? "";

  function toggle(id: string) {
    setSkipped((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runFrom(steps: Step[], from: number, count: number) {
    for (let i = from; i < steps.length; i++) {
      setRun({ kind: "running", steps, at: i, count });
      try {
        await steps[i]();
      } catch (e) {
        console.error(e);
        setRun({ kind: "failed", steps, at: i, count, message: (e as Error).message });
        return;
      }
    }
    setRun({ kind: "done", count });
  }

  function start() {
    setConfirm(false);
    void runFrom(makeSteps(hitungUlangPlan(selected, allItems), date), 0, selected.length);
  }

  const back = (
    <button className="btn-link" onClick={onBack} disabled={run.kind === "running"}>
      ← Kembali ke Pengaturan
    </button>
  );

  if (run.kind === "done") {
    return (
      <>
        {back}
        <h1 className="page-title">Jadikan Hitung Fisik</h1>
        <div className="all-good">
          <Icon type="check" size={22} /> Selesai. {run.count} catatan sudah dijadikan hitung fisik.
        </div>
        <p className="page-sub kosongkan-next">
          Jumlah stok tidak berubah. Di LPLPO, angkanya sekarang ada di Stok Awal (dengan keterangan Selisih), bukan di
          Penerimaan.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onLplpo}>
          <Icon type="printer" size={20} /> Buka LPLPO
        </button>
      </>
    );
  }

  if (run.kind === "running" || run.kind === "failed") {
    return (
      <>
        {back}
        <h1 className="page-title">Jadikan Hitung Fisik</h1>
        {run.kind === "running" ? (
          <div className="loading-screen">
            <div className="spinner" />
            <div>
              Menyimpan... langkah {run.at + 1} dari {run.steps.length}. Jangan tutup aplikasi.
            </div>
          </div>
        ) : (
          <div className="alert-panel">
            <div className="alert-panel-title">
              <Icon type="alert" size={22} /> Terhenti di langkah {run.at + 1} dari {run.steps.length}
            </div>
            <div className="alert-row">
              <div>
                Penyimpanan ke server gagal ({run.message}). Stok beberapa barang mungkin masih lebih kecil dari
                seharusnya. Periksa sinyal, lalu tekan <b>Coba lagi</b>. Jangan tutup halaman ini sebelum selesai.
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => void runFrom(run.steps, run.at, run.count)}>
              Coba lagi
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {back}
      <h1 className="page-title">Jadikan Hitung Fisik</h1>
      <p className="page-sub">
        Untuk hasil <b>hitung ulang stok</b> yang terlanjur dicatat sebagai <b>Barang Masuk</b>. Catatannya dibatalkan
        lalu dicatat ulang sebagai stok opname. <b>Jumlah stok tidak berubah.</b> Di LPLPO angkanya pindah dari
        Penerimaan ke Stok Awal, jadi farmasi tidak mengira barang itu mereka berikan.
      </p>

      <div className="form-group hitung-ulang-date">
        <label className="form-label" htmlFor="hu-date">
          Tanggal hitung ulang
        </label>
        <input
          id="hu-date"
          className="form-input"
          type="date"
          min={monthStart}
          max={today}
          value={date}
          onChange={(e) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
              setDate(e.target.value);
              setSkipped(new Set());
            }
          }}
        />
        <p className="form-hint">Hanya bulan ini, supaya LPLPO bulan lalu yang mungkin sudah dicetak tidak berubah.</p>
      </div>

      {candidates.length === 0 ? (
        <p className="text-faint">Tidak ada catatan Barang Masuk pada {formatDate(date)}.</p>
      ) : (
        <>
          <p className="form-hint">
            Hilangkan centang pada barang yang <b>benar-benar diterima dari farmasi</b> hari itu.
          </p>
          <p className="list-label">
            {candidates.length} catatan Barang Masuk pada {formatDate(date)} · {selected.length} dipilih
          </p>
          <div className="hitung-ulang-list">
            {candidates.map((t) => {
              const on = !skipped.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`kritis-toggle pick-toggle${on ? " active" : ""}`}
                  onClick={() => toggle(t.id)}
                  aria-pressed={on}
                >
                  <div className={`kritis-check${on ? " checked" : ""}`}>{on && <Icon type="check" size={14} />}</div>
                  <div>
                    <div className="kritis-label">
                      {t.itemName} — {t.qty} {unitOf(t.itemId)}
                    </div>
                    <div className="kritis-sub">
                      Dicatat {t.operator}
                      {t.createdAt && `, ${timeOf(t.createdAt)}`}
                      {mergedTargetName(t.itemId, allItems) &&
                        ` · sudah digabung ke ${mergedTargetName(t.itemId, allItems)}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="btn-group hitung-ulang-pick">
            <button className="btn btn-ghost btn-sm" onClick={() => setSkipped(new Set())}>
              Pilih semua
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSkipped(new Set(candidates.map((t) => t.id)))}>
              Kosongkan pilihan
            </button>
          </div>

          {!online && (
            <div className="merge-warn">
              <Icon type="alert" size={20} /> Butuh sinyal internet. Tunggu sampai tulisan <b>Tersambung</b> muncul di
              atas.
            </div>
          )}
          <button
            className="btn btn-primary btn-lg"
            disabled={selected.length === 0 || !online}
            onClick={() => setConfirm(true)}
          >
            <Icon type="check" size={20} /> Jadikan hitung fisik ({selected.length})
          </button>
        </>
      )}

      {confirm && (
        <Modal title="Jadikan hitung fisik?" onClose={() => setConfirm(false)}>
          <p className="page-sub">
            {selected.length} catatan Barang Masuk dari {itemCount} barang akan dibatalkan lalu dicatat ulang sebagai
            stok opname.
          </p>
          <p className="void-explain">
            Jumlah stok tidak berubah. Riwayat tetap menyimpan catatan lama beserta pembatalannya.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={start}>
              <Icon type="check" size={18} /> Ya, jadikan hitung fisik
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

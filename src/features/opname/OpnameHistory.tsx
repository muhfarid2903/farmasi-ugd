import { useEffect, useState } from "react";
import { friendlyDate } from "../../lib/date";
import { diffText, opnameDiff } from "../../lib/opname";
import { subscribeOpnames } from "../../lib/repository";
import type { Opname } from "../../types";

/** Riwayat stok opname yang pernah disimpan. */
export function OpnameHistory() {
  const [list, setList] = useState<Opname[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => subscribeOpnames(setList, (e) => setError(e.message)), []);

  return (
    <>
      <h2 className="section-title">Riwayat stok opname</h2>
      {error && <div className="form-error">Riwayat opname tidak bisa dibuka: {error}</div>}
      {error ? null : list === null ? (
        <div className="empty-note">Membuka riwayat...</div>
      ) : list.length === 0 ? (
        <div className="empty-note">Belum pernah ada stok opname.</div>
      ) : (
        <div className="card-list">
          {list.map((o) => {
            const diffs = o.entries.filter((e) => opnameDiff(e) !== 0);
            return (
              <div key={o.id} className="tx-card opname-card">
                <div className="tx-card-body">
                  <div className="tx-card-text">
                    <b>{friendlyDate(o.date)}</b> oleh {o.operator}
                  </div>
                  <div className="tx-card-note">
                    {o.entries.length} barang dihitung · {diffs.length} selisih
                    {o.note && ` · ${o.note}`}
                  </div>
                  {open === o.id &&
                    (diffs.length === 0 ? (
                      <div className="recent-meta">Semua pas.</div>
                    ) : (
                      <div className="opname-review">
                        {diffs.map((e) => (
                          <div key={e.itemId} className="review-line">
                            <span>{e.itemName}</span>
                            <span>
                              {e.system} → {e.counted} ({diffText(e)})
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === o.id ? null : o.id)}>
                  {open === o.id ? "Tutup" : "Lihat"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

import { createPortal } from "react-dom";
import { LPLPO_KEPALA, type LplpoRow, type Signer } from "../../lib/lplpo";

export interface SheetRow {
  row: LplpoRow;
  permintaan: number;
}

interface LplpoSheetProps {
  periode: { pelaporan: string; pemakaian: string; tahun: string };
  rows: SheetRow[];
  signers: Signer[];
  kunjungan: { umum: number | null; bpjs: number | null; total: number | null };
  /** Tanggal dibuat, mis. "10 Oktober 2026" */
  dibuat: string;
}

const PEMBERIAN = ["DAU", "DAK", "P2", "KESMAS", "BS. PROP", "KESGRA"];
/** Lebar kolom (%), urut kolom 1–16. */
const WIDTHS = [3, 25, 5.5, 5, 5.5, 5.5, 5.5, 5, 5.5, 4, 4, 3, 4.5, 4.5, 4.5, 10];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>:</td>
      <td>{value}</td>
    </tr>
  );
}

/**
 * Lembar LPLPO siap cetak, meniru form kertas Dinkes Pangkep (kertas mendatar).
 * Dipasang langsung di <body> dan hanya tampil saat halaman LPLPO dicetak.
 */
export function LplpoSheet({ periode, rows, signers, kunjungan, dibuat }: LplpoSheetProps) {
  const adaSelisih = rows.some((r) => r.row.selisih !== 0);
  return createPortal(
    <div className="lplpo-sheet">
      <style>{"@page { size: landscape; margin: 10mm; }"}</style>
      <div className="lplpo-title">LAPORAN PEMAKAIAN DAN LEMBAR PERMINTAAN OBAT</div>
      <div className="lplpo-title">( L P L P O )</div>
      <div className="lplpo-kepala">
        <table className="lplpo-fields">
          <tbody>
            <Field label="KODE PUSKESMAS" value={LPLPO_KEPALA.kodePuskesmas} />
            <Field label="PUSTU/ POSKESDES" value={LPLPO_KEPALA.unit} />
            <Field label="KAB/ KOTA" value={LPLPO_KEPALA.kabupaten} />
            <Field label="PROPINSI" value={LPLPO_KEPALA.provinsi} />
          </tbody>
        </table>
        <table className="lplpo-fields">
          <tbody>
            <Field label="BULAN PELAPORAN" value={periode.pelaporan} />
            <Field label="BULAN PEMAKAIAN" value={periode.pemakaian} />
            <Field label="TAHUN" value={periode.tahun} />
          </tbody>
        </table>
      </div>

      <table className="lplpo-table">
        <colgroup>
          {WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2}>NO</th>
            <th rowSpan={2}>NAMA OBAT</th>
            <th rowSpan={2}>SATUAN</th>
            <th rowSpan={2}>
              STOK
              <br />
              AWAL
            </th>
            <th rowSpan={2}>
              PENERIM
              <br />
              AAN
            </th>
            <th rowSpan={2}>
              PERSEDIA
              <br />
              AN
            </th>
            <th rowSpan={2}>
              PEMAKA
              <br />
              IAN
            </th>
            <th rowSpan={2}>
              SISA
              <br />
              STOK
            </th>
            <th rowSpan={2}>
              PERMINT
              <br />
              AAN
            </th>
            <th colSpan={PEMBERIAN.length}>PEMBERIAN</th>
            <th rowSpan={2}>KET</th>
          </tr>
          <tr>
            {PEMBERIAN.map((p) => (
              <th key={p} className="lplpo-small">
                {p}
              </th>
            ))}
          </tr>
          <tr className="lplpo-colnum">
            {["1", "2", "3", "4", "5", "6 (4 + 5)", "7", "8 (6 − 7)", "9"].map((c) => (
              <th key={c}>{c}</th>
            ))}
            {PEMBERIAN.map((p, i) => (
              <th key={p}>{10 + i}</th>
            ))}
            <th>16</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row: r, permintaan }, i) => (
            <tr key={r.itemId}>
              <td className="num">{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.unit}</td>
              <td className="num">{r.stokAwal}</td>
              <td className="num">{r.penerimaan}</td>
              <td className="num">{r.persediaan}</td>
              <td className="num">{r.pemakaian}</td>
              <td className="num">{r.sisa}</td>
              <td className="num">{permintaan}</td>
              {PEMBERIAN.map((p) => (
                <td key={p} />
              ))}
              <td className="lplpo-small">{r.ket}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="lplpo-catatan">
        {adaSelisih && "Ket “Selisih”: selisih hitung fisik/koreksi stok, sudah diperhitungkan di Stok Awal. "}
        Dibuat dari e-Stok UGD, {dibuat}.
      </div>

      <div className="lplpo-akhir">
        <table className="lplpo-kunjungan">
          <tbody>
            <tr>
              <th rowSpan={2}>JUMLAH KUNJUNGAN</th>
              <th>UMUM</th>
              <th>BPJS</th>
              <th>TOTAL</th>
            </tr>
            <tr>
              <td>{kunjungan.umum ?? ""}</td>
              <td>{kunjungan.bpjs ?? ""}</td>
              <td>{kunjungan.total ?? ""}</td>
            </tr>
          </tbody>
        </table>
        <div className="lplpo-ttd">
          {signers.map((s, i) => (
            <div key={i} className="lplpo-ttd-col">
              <div>{s.role}</div>
              <div>{s.title}</div>
              <div className={`lplpo-ttd-name${s.name.trim() ? "" : " blank"}`}>{s.name}</div>
              <div>NIP. {s.nip}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

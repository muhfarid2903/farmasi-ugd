const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

interface ExpiryPickerProps {
  /** "YYYY-MM", atau "" jika tidak diisi. */
  value: string;
  onChange: (value: string) => void;
  idPrefix: string;
}

/** Pilih bulan & tahun kedaluwarsa dengan dua pilihan besar, tanpa mengetik tanggal. */
export function ExpiryPicker({ value, onChange, idPrefix }: ExpiryPickerProps) {
  const [y, m] = value ? value.split("-") : ["", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, i) => String(thisYear - 2 + i));
  if (y && !years.includes(y)) years.unshift(y);

  function update(year: string, month: string) {
    if (!year && !month) return onChange("");
    // Isi otomatis bagian yang belum dipilih supaya nilainya selalu lengkap
    onChange(`${year || thisYear}-${month || "01"}`);
  }

  return (
    <div className="expiry-picker">
      <div className="form-row">
        <div>
          <label className="form-label" htmlFor={`${idPrefix}-month`}>
            Bulan
          </label>
          <select id={`${idPrefix}-month`} className="form-input" value={m} onChange={(e) => update(y, e.target.value)}>
            <option value="">— Pilih bulan —</option>
            {BULAN.map((b, i) => (
              <option key={b} value={String(i + 1).padStart(2, "0")}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor={`${idPrefix}-year`}>
            Tahun
          </label>
          <select id={`${idPrefix}-year`} className="form-input" value={y} onChange={(e) => update(e.target.value, m)}>
            <option value="">— Pilih tahun —</option>
            {years.map((yy) => (
              <option key={yy} value={yy}>
                {yy}
              </option>
            ))}
          </select>
        </div>
      </div>
      {value && (
        <button type="button" className="btn-link" onClick={() => onChange("")}>
          Kosongkan ED
        </button>
      )}
    </div>
  );
}

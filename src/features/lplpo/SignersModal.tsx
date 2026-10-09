import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { SIGNER_SLOTS, type Signer } from "../../lib/lplpo";

interface SignersModalProps {
  signers: Signer[];
  onSave: (signers: Signer[]) => void;
  onClose: () => void;
}

const EMPTY: Signer = { role: "", title: "", name: "", nip: "" };

/** Ubah penanda tangan LPLPO (khusus admin). Tersimpan untuk semua HP. */
export function SignersModal({ signers, onSave, onClose }: SignersModalProps) {
  const [draft, setDraft] = useState<Signer[]>(() =>
    Array.from({ length: SIGNER_SLOTS }, (_, i) => ({ ...EMPTY, ...signers[i] })),
  );

  function set(i: number, key: keyof Signer, value: string) {
    setDraft((d) => d.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
  }

  function save() {
    onSave(draft.map((s) => ({ role: s.role.trim(), title: s.title.trim(), name: s.name.trim(), nip: s.nip.trim() })));
  }

  const field = (i: number, key: keyof Signer, label: string, placeholder: string) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`ttd-${i}-${key}`}>
        {label}
      </label>
      <input
        id={`ttd-${i}-${key}`}
        className="form-input"
        placeholder={placeholder}
        inputMode={key === "nip" ? "numeric" : undefined}
        value={draft[i][key]}
        onChange={(e) => set(i, key, e.target.value)}
      />
    </div>
  );

  return (
    <Modal title="Penanda Tangan LPLPO" onClose={onClose}>
      <p className="form-hint">
        Dicetak di bagian bawah LPLPO, dari kiri ke kanan. Nama dan NIP boleh dikosongkan untuk ditulis tangan.
        Kosongkan semua isian satu penanda tangan bila tidak dipakai.
      </p>
      {draft.map((_, i) => (
        <fieldset key={i} className="signer-box">
          <legend>Penanda tangan {i + 1}</legend>
          <div className="form-row">
            {field(i, "role", "Keterangan", "Mis. Mengetahui,")}
            {field(i, "title", "Jabatan", "Mis. Kepala Puskesmas")}
          </div>
          <div className="form-row">
            {field(i, "name", "Nama", "Boleh dikosongkan")}
            {field(i, "nip", "NIP", "Boleh dikosongkan")}
          </div>
        </fieldset>
      ))}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={save}>
          <Icon type="check" size={18} /> Simpan
        </button>
      </div>
    </Modal>
  );
}

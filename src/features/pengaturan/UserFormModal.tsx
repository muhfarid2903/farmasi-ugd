import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import type { Role, UserProfile } from "../../types";

interface UserFormModalProps {
  /** Petugas yang diedit; kosong berarti petugas baru. */
  user?: UserProfile;
  /** Admin tidak bisa menurunkan peran atau menonaktifkan dirinya sendiri. */
  isSelf: boolean;
  existingEmails: string[];
  onSubmit: (user: UserProfile) => void;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserFormModal({ user, isSelf, existingEmails, onSubmit, onClose }: UserFormModalProps) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "petugas");
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState("");

  function handleSubmit() {
    const e = email.trim().toLowerCase();
    if (!e || !name.trim()) return setError("Email dan nama wajib diisi");
    if (!EMAIL_RE.test(e)) return setError("Format email tidak valid");
    if (!user && existingEmails.includes(e)) return setError("Email ini sudah terdaftar");
    onSubmit({ email: e, name: name.trim(), role, active, createdAt: user?.createdAt });
  }

  return (
    <Modal title={user ? "Edit Petugas" : "Tambah Petugas"} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-group">
        <label className="form-label" htmlFor="user-email">
          Email Google
        </label>
        <input
          id="user-email"
          className="form-input"
          type="email"
          placeholder="nama@gmail.com"
          value={email}
          disabled={!!user}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="user-name">
          Nama (tampil di catatan transaksi)
        </label>
        <input
          id="user-name"
          className="form-input"
          placeholder="Contoh: Ns. Adriana"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="user-role">
            Peran
          </label>
          <select
            id="user-role"
            className="form-input"
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="petugas">Petugas</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="user-active">
            Status
          </label>
          <select
            id="user-active"
            className="form-input"
            value={active ? "1" : "0"}
            disabled={isSelf}
            onChange={(e) => setActive(e.target.value === "1")}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          <Icon type="check" size={16} /> Simpan
        </button>
      </div>
    </Modal>
  );
}

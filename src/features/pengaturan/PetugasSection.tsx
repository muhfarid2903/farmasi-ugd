import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { subscribeUsers } from "../../lib/repository";
import type { UserProfile } from "../../types";
import { UserFormModal } from "./UserFormModal";

interface PetugasSectionProps {
  currentEmail: string;
  onSave: (user: UserProfile, isNew: boolean) => void;
}

export function PetugasSection({ currentEmail, onSave }: PetugasSectionProps) {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<UserProfile | "new" | null>(null);

  useEffect(() => subscribeUsers(setUsers, (e) => setError(e.message)), []);

  return (
    <>
      <h2 className="section-title">Petugas</h2>
      <p className="page-sub">
        Hanya akun Google yang terdaftar dan aktif di sini yang bisa membuka aplikasi. Petugas mencatat barang masuk dan
        keluar; admin juga bisa mengubah data barang dan mengelola petugas.
      </p>
      <div className="page-actions">
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Icon type="plus" size={18} /> Tambah Petugas
        </button>
      </div>
      {error && <div className="form-error">Daftar petugas tidak bisa dibuka: {error}</div>}
      {users === null ? (
        <div className="empty-note">Membuka daftar petugas...</div>
      ) : (
        <div className="card-list">
          {users.map((u) => (
            <div key={u.email} className={`user-card${u.active ? "" : " inactive"}`}>
              <div className="stock-card-main">
                <div className="stock-card-name">
                  {u.name}
                  {u.email === currentEmail && <span className="muted"> (Anda)</span>}
                </div>
                <div className="stock-card-meta">{u.email}</div>
                <div className="stock-card-meta">
                  <span className={`tag ${u.role === "admin" ? "tag-admin" : "tag-cat"}`}>
                    {u.role === "admin" ? "Admin" : "Petugas"}
                  </span>{" "}
                  {u.active ? "Aktif" : "Nonaktif — tidak bisa masuk"}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>
                <Icon type="edit" size={16} /> Ubah
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <UserFormModal
          user={editing === "new" ? undefined : editing}
          isSelf={editing !== "new" && editing.email === currentEmail}
          existingEmails={(users ?? []).map((u) => u.email)}
          onSubmit={(u) => {
            onSave(u, editing === "new");
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

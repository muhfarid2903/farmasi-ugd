import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { subscribeUsers } from "../../lib/repository";
import type { UserProfile } from "../../types";
import { UserFormModal } from "./UserFormModal";

interface PetugasPageProps {
  currentEmail: string;
  onSave: (user: UserProfile, isNew: boolean) => void;
}

export function PetugasPage({ currentEmail, onSave }: PetugasPageProps) {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<UserProfile | "new" | null>(null);

  useEffect(() => subscribeUsers(setUsers, (e) => setError(e.message)), []);

  return (
    <>
      <h1 className="page-title">Petugas</h1>
      <p className="page-sub">
        Hanya akun Google yang terdaftar dan aktif di sini yang bisa membuka aplikasi. Petugas mencatat transaksi; admin
        juga bisa mengelola item dan petugas.
      </p>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Icon type="plus" size={16} /> Tambah Petugas
        </button>
      </div>
      {error && <div className="form-error">Gagal memuat daftar petugas: {error}</div>}
      <div className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email Google</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Memuat...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.email} className={u.active ? undefined : "tx-voided"}>
                    <td className="semibold">
                      {u.name}
                      {u.email === currentEmail && <span className="muted small"> (Anda)</span>}
                    </td>
                    <td className="mono small">{u.email}</td>
                    <td>
                      <span className={`tag ${u.role === "admin" ? "tag-admin" : "tag-cat"}`}>
                        {u.role === "admin" ? "Admin" : "Petugas"}
                      </span>
                    </td>
                    <td>{u.active ? "Aktif" : "Nonaktif"}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing(u)}
                        aria-label={`Edit ${u.name}`}
                      >
                        <Icon type="edit" size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

import { useState } from "react";
import { Header } from "../../components/Header";
import { logout, signInWithGoogle } from "../../hooks/useAuth";

const IGNORED_ERRORS = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

export function LoginScreen() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (!IGNORED_ERRORS.includes(code)) {
        setError(
          code === "auth/network-request-failed"
            ? "Tidak ada sinyal. Login pertama kali butuh koneksi internet."
            : `Login gagal (${code || (e as Error).message}).`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <Header />
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="page-title">Masuk</h1>
          <p className="page-sub">Gunakan akun Google yang sudah didaftarkan admin UGD.</p>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-block" onClick={handleLogin} disabled={busy}>
            {busy ? "Membuka Google..." : "Masuk dengan Google"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnregisteredScreen({ email }: { email: string }) {
  return (
    <div className="app">
      <Header />
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="page-title">Akun belum terdaftar</h1>
          <p className="page-sub">
            <span className="mono">{email}</span> belum didaftarkan atau sudah dinonaktifkan. Minta admin UGD
            menambahkan email ini di menu <b>Petugas</b>, lalu buka ulang aplikasi.
          </p>
          <button className="btn btn-ghost btn-block" onClick={() => logout()}>
            Masuk dengan akun lain
          </button>
        </div>
      </div>
    </div>
  );
}

import App from "./App";
import { Header } from "./components/Header";
import { LoginScreen, UnregisteredScreen } from "./features/auth/AuthScreens";
import { useAuth } from "./hooks/useAuth";
import { useNewAddress } from "./hooks/useNewAddress";
import { PindahAlamatScreen } from "./features/pindah/PindahAlamat";

/** Gerbang login: aplikasi hanya dimuat untuk petugas yang terdaftar dan aktif. */
export default function Root() {
  const auth = useAuth();
  // Dibuka dari alamat lama padahal alamat baru sudah aktif
  const moved = useNewAddress();

  if (auth.status === "loading") {
    return (
      <div className="app">
        <Header />
        <div className="loading-screen">
          <div className="spinner" />
          <div>Memeriksa akun...</div>
        </div>
      </div>
    );
  }
  if (moved && auth.status !== "ready") return <PindahAlamatScreen />;
  if (auth.status === "signedOut") return <LoginScreen />;
  if (auth.status === "unregistered") return <UnregisteredScreen email={auth.user.email ?? ""} />;
  // key: data dimuat ulang bersih jika akun berganti
  return <App key={auth.profile.email} profile={auth.profile} moved={moved} />;
}

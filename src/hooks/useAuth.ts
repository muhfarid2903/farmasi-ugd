import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { subscribeProfile } from "../lib/repository";
import type { UserProfile } from "../types";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  /** Login berhasil, tetapi email belum didaftarkan admin atau sudah dinonaktifkan. */
  | { status: "unregistered"; user: User }
  | { status: "ready"; user: User; profile: UserProfile };

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<{ email: string; data: UserProfile | null } | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user?.email) return;
    const email = user.email.toLowerCase();
    return subscribeProfile(
      email,
      (data) => setProfile({ email, data }),
      () => setProfile({ email, data: null }),
    );
  }, [user]);

  if (user === undefined) return { status: "loading" };
  if (user === null) return { status: "signedOut" };
  const email = user.email?.toLowerCase();
  if (!profile || profile.email !== email) return { status: "loading" };
  if (!profile.data?.active) return { status: "unregistered", user };
  return { status: "ready", user, profile: profile.data };
}

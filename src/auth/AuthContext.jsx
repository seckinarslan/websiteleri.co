import { createContext, useContext, useEffect, useState } from "react";
import { auth, provider } from "../services/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { safe } from "../utils/safe";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
    });
    return () => unsub();
  }, []);

  async function login() {
    await safe("Giriş", () => signInWithPopup(auth, provider));
  }

  async function logout() {
    await safe("Çıkış", () => signOut(auth));
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}

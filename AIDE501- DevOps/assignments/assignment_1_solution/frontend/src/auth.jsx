import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // On load, ask the API who the stored token belongs to (it may have expired).
  useEffect(() => {
    if (!tokenStore.get()) return setReady(true);
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  const signIn = async (mode, form) => {
    const data = await api(`/auth/${mode}`, { method: "POST", body: form });
    tokenStore.set(data.token);
    setUser(data.user);
  };

  const signOut = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

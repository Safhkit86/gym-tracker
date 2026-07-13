import { useEffect, useState, type ReactNode } from "react";
import type { PublicUser } from "@gym-tracker/shared";
import * as authApi from "../api/auth";
import { AuthContext, type AuthContextValue } from "./context";

const TOKEN_STORAGE_KEY = "gym-tracker.token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verifica che il token salvato sia ancora valido caricando /me; se il
  // gateway risponde 401 il token viene scartato. Se `user` e' gia' popolato
  // (login/register l'hanno appena impostato insieme al token) non rifare la
  // chiamata: eviterebbe solo un flash di "Caricamento..." subito dopo
  // l'accesso, dato che abbiamo gia' i dati freschi dalla risposta.
  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    if (user) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    authApi
      .me(token)
      .then((fetchedUser) => {
        if (!cancelled) {
          setUser(fetchedUser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  function persistToken(newToken: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  }

  async function login(email: string, password: string): Promise<void> {
    const result = await authApi.login({ email, password });
    setUser(result.user);
    persistToken(result.token);
  }

  async function register(email: string, password: string): Promise<void> {
    const result = await authApi.register({ email, password });
    setUser(result.user);
    persistToken(result.token);
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }

  const value: AuthContextValue = { token, user, isLoading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

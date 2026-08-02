import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DeviceEventEmitter } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PublicUser } from "@gym-tracker/shared";
import * as authApi from "../api/auth";
import { UNAUTHORIZED_EVENT } from "../api/client";
import { AuthContext, type AuthContextValue } from "./context";

const TOKEN_STORAGE_KEY = "gym-tracker.token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // SecureStore e' async-only (a differenza di localStorage sul web, che si
  // legge in modo sincrono nell'useState iniziale): finche' non risponde,
  // non sappiamo ancora se un token esiste, quindi l'effetto sotto che
  // verifica il token deve aspettare questo flag prima di decidere.
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(TOKEN_STORAGE_KEY).then((storedToken) => {
      if (!cancelled) {
        setToken(storedToken);
        setIsHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Verifica che il token salvato sia ancora valido caricando /me; se il
  // gateway risponde 401 il token viene scartato. Se `user` e' gia' popolato
  // (login/register l'hanno appena impostato insieme al token) non rifare la
  // chiamata: eviterebbe solo un flash di "Caricamento..." subito dopo
  // l'accesso, dato che abbiamo gia' i dati freschi dalla risposta.
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
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
          void SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
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
  }, [isHydrated, token, user]);

  async function persistToken(newToken: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  }

  async function login(email: string, password: string): Promise<void> {
    const result = await authApi.login({ email, password });
    setUser(result.user);
    await persistToken(result.token);
  }

  async function register(email: string, password: string): Promise<void> {
    const result = await authApi.register({ email, password });
    setUser(result.user);
    await persistToken(result.token);
  }

  const logout = useCallback((): void => {
    void SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Un 401 su una richiesta autenticata (token scaduto/non valido) fa logout
  // automatico: senza questo, il token resta "valido" lato client finche' non
  // si riavvia l'app, e ogni chiamata continua a fallire mostrando l'errore
  // grezzo invece di riportare l'utente al login. Stesso ruolo
  // dell'equivalente su web, via DeviceEventEmitter invece che window.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(UNAUTHORIZED_EVENT, logout);
    return () => subscription.remove();
  }, [logout]);

  const value: AuthContextValue = { token, user, isLoading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

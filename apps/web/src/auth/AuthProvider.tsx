import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { PublicUser } from "@gym-tracker/shared";
import * as authApi from "../api/auth";
import { UNAUTHORIZED_EVENT } from "../api/client";
import { AuthContext, type AuthContextValue } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Non piu' il JWT reale: da quando la sessione viaggia in un cookie
  // httpOnly (illeggibile da JS, vedi client.ts/packages/shared/src/auth.ts),
  // la webapp non ha piu' nulla da leggere/scrivere in localStorage. Questo
  // resta un marcatore locale "ho una sessione" (l'id utente una volta
  // autenticati, altrimenti null), usato dalle guardie `if (!token)` sparse
  // nell'app e passato (ignorato per l'header, vedi client.ts) alle
  // funzioni api/*.ts esistenti — evita di dover toccare ogni pagina/
  // funzione che oggi si aspetta un `token` da passare in giro.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Il cookie httpOnly non e' leggibile da JS: l'unico modo di sapere, al
  // primo caricamento della pagina, se il browser ha ancora una sessione
  // valida e' chiamare /me e vedere se risponde 200 (il browser manda il
  // cookie da solo, vedi `credentials: "include"` in apiRequest) o 401.
  // A differenza di prima (un controllo sincrono su localStorage), questo
  // comporta sempre un giro di rete ad ogni refresh della pagina — il
  // costo accettato per non tenere piu' il token in un posto leggibile da JS.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((fetchedUser) => {
        if (!cancelled) {
          setUser(fetchedUser);
          setToken(fetchedUser.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
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
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const result = await authApi.login({ email, password });
    setUser(result.user);
    setToken(result.user.id);
  }

  async function register(email: string, password: string): Promise<void> {
    const result = await authApi.register({ email, password });
    setUser(result.user);
    setToken(result.user.id);
  }

  const logout = useCallback((): void => {
    // Best-effort, non aspettato: anche se la richiesta di rete fallisse
    // (es. offline), l'utente deve comunque vedere l'app come disconnessa
    // subito — il cookie lato server resterebbe valido fino alla scadenza
    // naturale (1h) in quel caso limite, non c'e' modo di garantire
    // altrimenti senza bloccare la UI finche' la richiesta non risponde.
    void authApi.logout().catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  const refreshToken = useCallback(async (): Promise<void> => {
    const result = await authApi.refreshToken();
    setUser(result.user);
    setToken(result.user.id);
  }, []);

  // Un 401 su una richiesta autenticata (token scaduto/non valido) fa logout
  // automatico: senza questo, il token resta "valido" lato client finche' non
  // si ricarica la pagina, e ogni chiamata continua a fallire mostrando
  // l'errore grezzo invece di riportare l'utente al login.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const value: AuthContextValue = {
    token,
    user,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

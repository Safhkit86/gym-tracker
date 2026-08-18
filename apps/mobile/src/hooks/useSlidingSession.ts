import { useEffect, useRef } from "react";

/** Ben dentro l'ora di scadenza del token (packages/shared/src/auth.ts):
 *  anche se un singolo tentativo fallisce (rete instabile), il successivo
 *  riparte comunque prima della scadenza effettiva. */
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Rinnova periodicamente il token finche' il componente chiamante resta
 * montato: pensato per schermate dove un'attivita' puo' durare piu' a
 * lungo della scadenza fissa del token (1h) — oggi solo Registra sessione,
 * dove una sessione di allenamento puo' superare abbondantemente un'ora.
 * Il resto dell'app mantiene il comportamento normale (logout automatico
 * dopo un'ora di inattivita', vedi AuthProvider): e' una scelta di
 * sicurezza voluta, non un'omissione — questo hook va richiamato solo
 * dalle schermate dove serve davvero restare loggati piu' a lungo.
 * Equivalente mobile di apps/web/src/hooks/useSlidingSession.ts (stessa
 * logica, nessuna dipendenza da API web-only).
 *
 * Un fallimento di un singolo tentativo non e' trattato come errore
 * bloccante: se il token scade comunque (tutti i tentativi falliti per
 * l'intera ora, es. rete assente o app in background a lungo), la
 * prossima richiesta autenticata fallira' con 401 e AuthProvider fara' il
 * consueto logout automatico — stesso fallback di sempre, non un caso
 * nuovo da gestire qui.
 */
export function useSlidingSession(refreshToken: () => Promise<void>): void {
  // Sempre aggiornato (stesso trucco di AuthProvider.tokenRef): l'intervallo
  // sotto viene creato una volta sola e non deve richiamare una closure
  // "vecchia" di refreshToken.
  const refreshTokenRef = useRef(refreshToken);
  refreshTokenRef.current = refreshToken;

  useEffect(() => {
    const interval = setInterval(() => {
      refreshTokenRef.current().catch(() => {
        // Silenzioso: vedi commento sopra, il fallback e' il logout
        // automatico esistente su un vero 401, non qui.
      });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
}

import type { ApiError } from "@gym-tracker/shared";

// HTTPS di default (non la porta HTTP usata dall'app mobile): il cookie
// httpOnly della sessione web richiede Secure — vedi AUTH_COOKIE_NAME in
// packages/shared/src/auth.ts e docker-compose.yml, servizio api-gateway.
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "https://localhost:4443";

/** Emesso quando una richiesta autenticata (token presente) riceve 401: il
 * token e' scaduto o non piu' valido. AuthProvider ci fa logout automatico,
 * cosi' l'utente torna al login invece di restare bloccato su un errore a
 * schermo. Non emesso per i 401 di login/register (nessun token inviato:
 * li' significa "credenziali errate", non "sessione scaduta"). */
export const UNAUTHORIZED_EVENT = "gym-tracker:unauthorized";

/** Errore lanciato quando il gateway risponde con uno status non-2xx. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  /** Es. { issues: [{ path, message }] } per VALIDATION_ERROR: usato dai
   *  form per evidenziare il campo incriminato, non solo il messaggio. */
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /**
   * Non piu' usato per l'header Authorization (la sessione viaggia nel
   * cookie httpOnly, mandato automaticamente dal browser — vedi
   * `credentials: "include"` sotto): un XSS che leggesse questo valore da
   * JS non otterrebbe comunque il JWT reale. Il parametro resta per non
   * dover toccare le decine di funzioni api/*.ts e le pagine che le
   * chiamano, tutte scritte per passare `token` — qui serve solo a decidere
   * se un 401 e' una sessione scaduta (vedi sotto) invece che credenziali
   * errate su login/register (che non passano `token`). Qualsiasi stringa
   * "veritiera" va bene (oggi: l'id utente, vedi AuthProvider.tsx).
   */
  token?: string | null;
}

/**
 * Client HTTP minimale verso l'api-gateway (mai verso i singoli servizi,
 * vedi CLAUDE.md). Nessuna query library: fetch nativo + gestione manuale
 * degli errori in ApiRequestError.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    // Manda/riceve il cookie httpOnly di sessione anche cross-origin
    // (webapp e gateway restano origini diverse anche in locale): senza,
    // il browser non manderebbe mai il cookie su un fetch verso un'altra
    // origine, nonostante Set-Cookie l'avesse impostato correttamente.
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json()
    : undefined;

  if (!response.ok) {
    const apiError = data as ApiError | undefined;
    if (response.status === 401 && options.token) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiRequestError(
      response.status,
      apiError?.code ?? "UNKNOWN_ERROR",
      apiError?.message ?? "Errore imprevisto. Riprova.",
      apiError?.details
    );
  }

  return data as T;
}

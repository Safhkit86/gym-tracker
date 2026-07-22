import type { ApiError } from "@gym-tracker/shared";

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
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

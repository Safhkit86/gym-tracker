import type { ApiError } from "@gym-tracker/shared";

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

/** Errore lanciato quando il gateway risponde con uno status non-2xx. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
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
    throw new ApiRequestError(
      response.status,
      apiError?.code ?? "UNKNOWN_ERROR",
      apiError?.message ?? "Errore imprevisto. Riprova."
    );
  }

  return data as T;
}

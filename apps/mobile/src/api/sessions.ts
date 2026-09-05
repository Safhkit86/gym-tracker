import type { Paginated, SessionDetail, SessionInput, SessionStatus } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listSessions(token: string, limit?: number): Promise<SessionDetail[]> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return apiRequest<SessionDetail[]>(`/sessions${query}`, { token });
}

export interface ListSessionsPageOptions {
  page: number;
  pageSize: number;
  /** Data ISO (yyyy-mm-dd): filtro rapido periodo (1M/3M/1Y/5Y) in Storico. */
  since?: string;
  /** Default "desc" — vedi ListSessionsPageOptions in apps/web/src/api/sessions.ts. */
  order?: "asc" | "desc";
}

/** Pagina di storico per la schermata Storico — vedi listSessions per la
 *  versione non paginata (invariata). Query string costruita a mano (niente
 *  URLSearchParams: non e' detto sia disponibile su Hermes/React Native
 *  senza un polyfill dedicato, mai aggiunto a questo progetto). */
export function listSessionsPage(
  token: string,
  options: ListSessionsPageOptions
): Promise<Paginated<SessionDetail>> {
  let query = `?page=${options.page}&pageSize=${options.pageSize}`;
  if (options.since) {
    query += `&since=${encodeURIComponent(options.since)}`;
  }
  if (options.order) {
    query += `&order=${options.order}`;
  }
  return apiRequest<Paginated<SessionDetail>>(`/sessions${query}`, { token });
}

export function logSession(token: string, body: SessionInput): Promise<SessionDetail> {
  return apiRequest<SessionDetail>("/sessions", { method: "POST", body, token });
}

export function deleteSession(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/sessions/${id}`, { method: "DELETE", token });
}

export function getSessionStatus(token: string, sessionId: string): Promise<SessionStatus> {
  return apiRequest<SessionStatus>(`/sessions/${sessionId}/status`, { token });
}

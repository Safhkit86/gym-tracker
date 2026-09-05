import type { Paginated, SessionDetail, SessionInput, SessionStatus } from "@gym-tracker/shared";
import { apiRequest } from "./client";

/** Storico gia' con esercizi/set inclusi: la pagina storico li mostra
 *  espansi, senza una seconda chiamata per sessione. `limit` opzionale (es.
 *  la Dashboard vuole solo l'ultima sessione). */
export function listSessions(token: string, limit?: number): Promise<SessionDetail[]> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return apiRequest<SessionDetail[]>(`/sessions${query}`, { token });
}

export interface ListSessionsPageOptions {
  page: number;
  pageSize: number;
  /** Data ISO (yyyy-mm-dd): filtro rapido periodo (1M/3M/1Y/5Y) in Storico. */
  since?: string;
  /** Default "desc": segue il toggle "piu' recenti/meno recenti prima" di
   *  Storico, che con la paginazione lato server non puo' piu' limitarsi a
   *  invertire in locale l'array gia' caricato. */
  order?: "asc" | "desc";
}

/** Pagina di storico per la UI di Storico — vedi listSessions per la
 *  versione non paginata (usata da Dashboard/Statistiche, invariata). */
export function listSessionsPage(
  token: string,
  options: ListSessionsPageOptions
): Promise<Paginated<SessionDetail>> {
  const params = new URLSearchParams({
    page: String(options.page),
    pageSize: String(options.pageSize),
  });
  if (options.since) {
    params.set("since", options.since);
  }
  if (options.order) {
    params.set("order", options.order);
  }
  return apiRequest<Paginated<SessionDetail>>(`/sessions?${params.toString()}`, { token });
}

/** Salva solo la sessione (history-service): non calcola piu' suggerimenti
 *  sincroni, valutati in modo asincrono da progress-service (vedi
 *  getSessionStatus). */
export function logSession(token: string, body: SessionInput): Promise<SessionDetail> {
  return apiRequest<SessionDetail>("/sessions", { method: "POST", body, token });
}

export function deleteSession(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/sessions/${id}`, { method: "DELETE", token });
}

/** Stato dell'elaborazione asincrona di una sessione appena registrata
 *  (progress-service): LogSessionPage.tsx fa un breve polling qui per
 *  continuare a mostrare subito l'eventuale suggerimento, come prima dello
 *  split tra history-service e progress-service. */
export function getSessionStatus(token: string, sessionId: string): Promise<SessionStatus> {
  return apiRequest<SessionStatus>(`/sessions/${sessionId}/status`, { token });
}

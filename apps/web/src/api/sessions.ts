import type { CreateSessionResponse, SessionDetail, SessionInput } from "@gym-tracker/shared";
import { apiRequest } from "./client";

/** Storico gia' con esercizi/set inclusi: la pagina storico li mostra
 *  espansi, senza una seconda chiamata per sessione. */
export function listSessions(token: string): Promise<SessionDetail[]> {
  return apiRequest<SessionDetail[]>("/sessions", { token });
}

export function logSession(token: string, body: SessionInput): Promise<CreateSessionResponse> {
  return apiRequest<CreateSessionResponse>("/sessions", { method: "POST", body, token });
}

export function deleteSession(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/sessions/${id}`, { method: "DELETE", token });
}

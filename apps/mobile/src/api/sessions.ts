import type { SessionDetail, SessionInput, SessionStatus } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listSessions(token: string, limit?: number): Promise<SessionDetail[]> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return apiRequest<SessionDetail[]>(`/sessions${query}`, { token });
}

export function logSession(token: string, body: SessionInput): Promise<SessionDetail> {
  return apiRequest<SessionDetail>("/sessions", { method: "POST", body, token });
}

export function getSessionStatus(token: string, sessionId: string): Promise<SessionStatus> {
  return apiRequest<SessionStatus>(`/sessions/${sessionId}/status`, { token });
}

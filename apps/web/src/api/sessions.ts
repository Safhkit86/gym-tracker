import type {
  CreateSessionResponse,
  SessionDetail,
  SessionInput,
  SessionSummary,
} from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listSessions(token: string): Promise<SessionSummary[]> {
  return apiRequest<SessionSummary[]>("/sessions", { token });
}

export function getSession(token: string, id: string): Promise<SessionDetail> {
  return apiRequest<SessionDetail>(`/sessions/${id}`, { token });
}

export function logSession(token: string, body: SessionInput): Promise<CreateSessionResponse> {
  return apiRequest<CreateSessionResponse>("/sessions", { method: "POST", body, token });
}

export function deleteSession(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/sessions/${id}`, { method: "DELETE", token });
}

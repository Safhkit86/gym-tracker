import type {
  AllenamentoSummary,
  CreateAllenamentoRequest,
  UpdateAllenamentoRequest,
} from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listAllenamenti(token: string): Promise<AllenamentoSummary[]> {
  return apiRequest<AllenamentoSummary[]>("/allenamenti", { token });
}

export function createAllenamento(token: string, name: string): Promise<AllenamentoSummary> {
  const body: CreateAllenamentoRequest = { name };
  return apiRequest<AllenamentoSummary>("/allenamenti", { method: "POST", body, token });
}

export function renameAllenamento(
  token: string,
  id: string,
  name: string
): Promise<AllenamentoSummary> {
  const body: UpdateAllenamentoRequest = { name };
  return apiRequest<AllenamentoSummary>(`/allenamenti/${id}`, { method: "PATCH", body, token });
}

export function activateAllenamento(token: string, id: string): Promise<AllenamentoSummary> {
  const body: UpdateAllenamentoRequest = { isActive: true };
  return apiRequest<AllenamentoSummary>(`/allenamenti/${id}`, { method: "PATCH", body, token });
}

export function deleteAllenamento(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/allenamenti/${id}`, { method: "DELETE", token });
}

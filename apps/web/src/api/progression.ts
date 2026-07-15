import type { ProgressionEvent } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listProgressionEvents(
  token: string,
  exerciseId?: string
): Promise<ProgressionEvent[]> {
  const query = exerciseId ? `?exerciseId=${encodeURIComponent(exerciseId)}` : "";
  return apiRequest<ProgressionEvent[]>(`/progression${query}`, { token });
}

import type { WorkoutDetail, WorkoutInput, WorkoutSummary } from "@gym-tracker/shared";
import { apiRequest } from "./client";

/** allenamentoId: filtro opzionale (usato dalla Dashboard per il "prossimo
 *  esercizio", limitato alle schede dell'allenamento attivo). Assente =
 *  tutte le schede, comportamento invariato (usato dalla lista Schede). */
export function listWorkouts(token: string, allenamentoId?: string): Promise<WorkoutSummary[]> {
  const query = allenamentoId ? `?allenamentoId=${allenamentoId}` : "";
  return apiRequest<WorkoutSummary[]>(`/workouts${query}`, { token });
}

export function getWorkout(token: string, id: string): Promise<WorkoutDetail> {
  return apiRequest<WorkoutDetail>(`/workouts/${id}`, { token });
}

export function createWorkout(token: string, body: WorkoutInput): Promise<WorkoutDetail> {
  return apiRequest<WorkoutDetail>("/workouts", { method: "POST", body, token });
}

export function updateWorkout(
  token: string,
  id: string,
  body: WorkoutInput
): Promise<WorkoutDetail> {
  return apiRequest<WorkoutDetail>(`/workouts/${id}`, { method: "PUT", body, token });
}

export function deleteWorkout(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/workouts/${id}`, { method: "DELETE", token });
}

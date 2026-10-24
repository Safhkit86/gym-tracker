import type {
  ReorderWorkoutsRequest,
  WorkoutDetail,
  WorkoutInput,
  WorkoutSummary,
} from "@gym-tracker/shared";
import { apiRequest } from "./client";

/** allenamentoId: filtro opzionale (usato dalla Dashboard per il "prossimo
 *  esercizio", limitato alle schede dell'allenamento attivo). Assente =
 *  tutte le schede, comportamento invariato (usato dalla pagina Schede). */
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

export function reorderWorkouts(token: string, workoutIds: string[]): Promise<void> {
  const body: ReorderWorkoutsRequest = { workoutIds };
  return apiRequest<void>("/workouts/reorder", { method: "PUT", body, token });
}

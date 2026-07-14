import type { WorkoutDetail, WorkoutInput, WorkoutSummary } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listWorkouts(token: string): Promise<WorkoutSummary[]> {
  return apiRequest<WorkoutSummary[]>("/workouts", { token });
}

export function getWorkout(token: string, id: string): Promise<WorkoutDetail> {
  return apiRequest<WorkoutDetail>(`/workouts/${id}`, { token });
}

export function createWorkout(token: string, body: WorkoutInput): Promise<WorkoutDetail> {
  return apiRequest<WorkoutDetail>("/workouts", { method: "POST", body, token });
}

export function deleteWorkout(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/workouts/${id}`, { method: "DELETE", token });
}

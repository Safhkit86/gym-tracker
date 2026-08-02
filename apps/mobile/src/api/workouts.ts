import type { WorkoutDetail, WorkoutSummary } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listWorkouts(token: string): Promise<WorkoutSummary[]> {
  return apiRequest<WorkoutSummary[]>("/workouts", { token });
}

export function getWorkout(token: string, id: string): Promise<WorkoutDetail> {
  return apiRequest<WorkoutDetail>(`/workouts/${id}`, { token });
}

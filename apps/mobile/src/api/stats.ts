import type { DashboardStats, ExerciseHistoryPoint, StalledExercise } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function getDashboardStats(token: string): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/stats", { token });
}

export function getExerciseHistory(
  token: string,
  exerciseId: string
): Promise<ExerciseHistoryPoint[]> {
  return apiRequest<ExerciseHistoryPoint[]>(
    `/sessions/exercise-history?exerciseId=${encodeURIComponent(exerciseId)}`,
    { token }
  );
}

export function getStalledExercise(token: string): Promise<StalledExercise | null> {
  return apiRequest<StalledExercise | null>("/progression/stalled", { token });
}

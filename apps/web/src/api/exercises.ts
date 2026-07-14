import type { CreateExerciseRequest, Exercise } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listExercises(token: string): Promise<Exercise[]> {
  return apiRequest<Exercise[]>("/exercises", { token });
}

export function createExercise(token: string, body: CreateExerciseRequest): Promise<Exercise> {
  return apiRequest<Exercise>("/exercises", { method: "POST", body, token });
}

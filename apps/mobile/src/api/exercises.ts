import type { Exercise } from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function listExercises(token: string): Promise<Exercise[]> {
  return apiRequest<Exercise[]>("/exercises", { token });
}

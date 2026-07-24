import type {
  ProgressionPreferences,
  UpdateProgressionPreferencesRequest,
  UpdateUserMeasurementsRequest,
  UserMeasurements,
} from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function getMeasurements(token: string): Promise<UserMeasurements> {
  return apiRequest<UserMeasurements>("/me/measurements", { token });
}

export function updateMeasurements(
  token: string,
  body: UpdateUserMeasurementsRequest
): Promise<UserMeasurements> {
  return apiRequest<UserMeasurements>("/me/measurements", { method: "PUT", body, token });
}

export function getProgressionPreferences(token: string): Promise<ProgressionPreferences> {
  return apiRequest<ProgressionPreferences>("/me/preferences", { token });
}

export function updateProgressionPreferences(
  token: string,
  body: UpdateProgressionPreferencesRequest
): Promise<ProgressionPreferences> {
  return apiRequest<ProgressionPreferences>("/me/preferences", { method: "PUT", body, token });
}

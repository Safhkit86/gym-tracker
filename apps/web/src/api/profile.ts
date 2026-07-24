import type { UpdateUserMeasurementsRequest, UserMeasurements } from "@gym-tracker/shared";
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

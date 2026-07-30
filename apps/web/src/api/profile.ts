import type {
  AcceptProgressionDefaultsRequest,
  AccountPreferences,
  ProgressionDefault,
  ProgressionPreferences,
  UpdateAccountPreferencesRequest,
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

export function getAccountPreferences(token: string): Promise<AccountPreferences> {
  return apiRequest<AccountPreferences>("/me/account-preferences", { token });
}

export function updateAccountPreferences(
  token: string,
  body: UpdateAccountPreferencesRequest
): Promise<AccountPreferences> {
  return apiRequest<AccountPreferences>("/me/account-preferences", {
    method: "PUT",
    body,
    token,
  });
}

export function getProgressionDefaults(token: string): Promise<ProgressionDefault[]> {
  return apiRequest<ProgressionDefault[]>("/me/progression-defaults", { token });
}

export function acceptProgressionDefaults(
  token: string,
  overrides: ProgressionDefault[]
): Promise<void> {
  const body: AcceptProgressionDefaultsRequest = { overrides };
  return apiRequest<void>("/me/progression-defaults", { method: "POST", body, token });
}

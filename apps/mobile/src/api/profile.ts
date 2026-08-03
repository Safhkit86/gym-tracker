import type {
  AcceptProgressionDefaultsRequest,
  AccountPreferences,
  ProgressionDefault,
} from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function getAccountPreferences(token: string): Promise<AccountPreferences> {
  return apiRequest<AccountPreferences>("/me/account-preferences", { token });
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

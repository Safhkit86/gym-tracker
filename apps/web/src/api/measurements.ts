import type { MeasurementEntry } from "@gym-tracker/shared";
import { apiRequest } from "./client";

/** Storico misure (history-service): piu' recenti prima. Il salvataggio non
 *  passa da qui, vedi updateMeasurements in profile.ts (PUT /me/measurements,
 *  account-service). */
export function listMeasurements(token: string): Promise<MeasurementEntry[]> {
  return apiRequest<MeasurementEntry[]>("/measurements", { token });
}

export function deleteMeasurement(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/measurements/${id}`, { method: "DELETE", token });
}

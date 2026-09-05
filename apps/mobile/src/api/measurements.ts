import type { MeasurementEntry, Paginated } from "@gym-tracker/shared";
import { apiRequest } from "./client";

/** Storico misure (history-service): piu' recenti prima. Il salvataggio non
 *  passa da qui, vive in Profilo (PUT /me/account-preferences non c'entra;
 *  vedi apps/web/src/api/profile.ts - updateMeasurements, account-service). */
export function listMeasurements(token: string): Promise<MeasurementEntry[]> {
  return apiRequest<MeasurementEntry[]>("/measurements", { token });
}

export interface ListMeasurementsPageOptions {
  page: number;
  pageSize: number;
  /** Data ISO (yyyy-mm-dd): filtro rapido periodo (1M/3M/1Y/5Y) in Storico. */
  since?: string;
}

/** Pagina di storico misure per la schermata Storico — vedi listMeasurements
 *  per la versione non paginata. */
export function listMeasurementsPage(
  token: string,
  options: ListMeasurementsPageOptions
): Promise<Paginated<MeasurementEntry>> {
  let query = `?page=${options.page}&pageSize=${options.pageSize}`;
  if (options.since) {
    query += `&since=${encodeURIComponent(options.since)}`;
  }
  return apiRequest<Paginated<MeasurementEntry>>(`/measurements${query}`, { token });
}

export function deleteMeasurement(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/measurements/${id}`, { method: "DELETE", token });
}

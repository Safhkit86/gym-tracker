import { exportAccountData, type AccountDataExport } from "../api/auth";
import { listWorkouts } from "../api/workouts";
import { listSessions } from "../api/sessions";
import { listMeasurements } from "../api/measurements";
import { listNotifications } from "../api/notifications";
import { listProgressionEvents } from "../api/progression";

/**
 * Diritto alla portabilita' dei dati (GDPR). account-service non ha un
 * endpoint di export cross-servizio (vedi commento su AccountDataExport nel
 * backend, services/account-service/src/domain/account-deletion-service.ts:
 * un export completo richiederebbe account-service a chiamare via HTTP
 * direttamente gli altri servizi, un pattern mai usato in questo progetto).
 * Qui invece si aggregano le rotte "lista completa" gia' esistenti (le
 * stesse usate dall'export CSV di Storico, vedi session-import-export.ts),
 * nessuna nuova rotta backend necessaria.
 */
export interface FullAccountDataExport {
  exportedAt: string;
  account: AccountDataExport;
  workouts: Awaited<ReturnType<typeof listWorkouts>>;
  sessions: Awaited<ReturnType<typeof listSessions>>;
  measurements: Awaited<ReturnType<typeof listMeasurements>>;
  notifications: Awaited<ReturnType<typeof listNotifications>>;
  progressionEvents: Awaited<ReturnType<typeof listProgressionEvents>>;
}

export async function buildFullAccountDataExport(token: string): Promise<FullAccountDataExport> {
  const [account, workouts, sessions, measurements, notifications, progressionEvents] =
    await Promise.all([
      exportAccountData(token),
      listWorkouts(token),
      listSessions(token),
      listMeasurements(token),
      listNotifications(token),
      listProgressionEvents(token),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    account,
    workouts,
    sessions,
    measurements,
    notifications,
    progressionEvents,
  };
}

/** Stesso meccanismo di downloadCsvFile (utils/csv.ts), con MIME JSON invece
 *  di CSV: nessuna richiesta di rete, solo un Blob locale scaricato via un
 *  link temporaneo (mai aggiunto al DOM). */
export function triggerExportDownload(data: FullAccountDataExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gym-tracker-dati-${data.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadFullAccountDataExport(token: string): Promise<void> {
  const data = await buildFullAccountDataExport(token);
  triggerExportDownload(data);
}

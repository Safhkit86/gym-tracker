import type { Migration } from "kysely";
import * as addMeasurementEntries from "./001-add-measurement-entries.js";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 *
 * `workout_sessions`/`session_sets` non hanno una migrazione qui: esistono
 * gia' (vedi db/migrate.ts). `001-add-measurement-entries` e' la prima
 * migrazione reale di questo servizio.
 */
export const migrations: Record<string, Migration> = {
  "001-add-measurement-entries": addMeasurementEntries,
};

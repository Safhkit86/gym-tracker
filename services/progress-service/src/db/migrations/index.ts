import type { Migration } from "kysely";
import * as createProgressTables from "./001-create-progress-tables.js";
import * as addMinMaxReps from "./002-add-min-max-reps.js";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 */
export const migrations: Record<string, Migration> = {
  "001-create-progress-tables": createProgressTables,
  "002-add-min-max-reps": addMinMaxReps,
};

import type { Migration } from "kysely";
import * as createNotificationsTable from "./001-create-notifications-table.js";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 */
export const migrations: Record<string, Migration> = {
  "001-create-notifications-table": createNotificationsTable,
};

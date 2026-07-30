import type { Migration } from "kysely";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 *
 * Vuoto per ora: `workout_sessions`/`session_sets` esistono gia' (vedi
 * migrate.ts). La prima migrazione reale di questo servizio arrivera' con
 * lo storico misure (`measurement_entries`).
 */
export const migrations: Record<string, Migration> = {};

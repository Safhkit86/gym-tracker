import type { Migration } from "kysely";
import * as createWorkoutTables from "./001-create-workout-tables.js";
import * as seedExercises from "./002-seed-exercises.js";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 */
export const migrations: Record<string, Migration> = {
  "001-create-workout-tables": createWorkoutTables,
  "002-seed-exercises": seedExercises,
};

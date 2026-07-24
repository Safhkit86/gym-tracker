import type { Migration } from "kysely";
import * as createProgressTables from "./001-create-progress-tables.js";
import * as addMinMaxReps from "./002-add-min-max-reps.js";
import * as addRestSecondsSnapshot from "./003-add-rest-seconds-snapshot.js";
import * as addExercisePosition from "./004-add-exercise-position.js";
import * as addWorkoutNotesSnapshot from "./005-add-workout-notes-snapshot.js";
import * as addActualRestSeconds from "./006-add-actual-rest-seconds.js";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 */
export const migrations: Record<string, Migration> = {
  "001-create-progress-tables": createProgressTables,
  "002-add-min-max-reps": addMinMaxReps,
  "003-add-rest-seconds-snapshot": addRestSecondsSnapshot,
  "004-add-exercise-position": addExercisePosition,
  "005-add-workout-notes-snapshot": addWorkoutNotesSnapshot,
  "006-add-actual-rest-seconds": addActualRestSeconds,
};

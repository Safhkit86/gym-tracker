import type { Migration } from "kysely";
import * as createProgressTables from "./001-create-progress-tables.js";
import * as addMinMaxReps from "./002-add-min-max-reps.js";
import * as addRestSecondsSnapshot from "./003-add-rest-seconds-snapshot.js";
import * as addExercisePosition from "./004-add-exercise-position.js";
import * as addWorkoutNotesSnapshot from "./005-add-workout-notes-snapshot.js";
import * as addActualRestSeconds from "./006-add-actual-rest-seconds.js";
import * as addProgressionPreferences from "./007-add-progression-preferences.js";
import * as addPrefillScope from "./008-add-prefill-scope.js";
import * as addProgressionDefaults from "./009-add-progression-defaults.js";
import * as addTimerSoundEnabled from "./010-add-timer-sound-enabled.js";
import * as renameOwnerIdToUserId from "./011-rename-owner-id-to-user-id.js";

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
  "007-add-progression-preferences": addProgressionPreferences,
  "008-add-prefill-scope": addPrefillScope,
  "009-add-progression-defaults": addProgressionDefaults,
  "010-add-timer-sound-enabled": addTimerSoundEnabled,
  "011-rename-owner-id-to-user-id": renameOwnerIdToUserId,
};

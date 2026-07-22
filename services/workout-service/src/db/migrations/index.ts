import type { Migration } from "kysely";
import * as createWorkoutTables from "./001-create-workout-tables.js";
import * as seedExercises from "./002-seed-exercises.js";
import * as addExerciseMetadataAndRest from "./003-add-exercise-metadata-and-rest.js";
import * as enrichExerciseCatalog from "./004-enrich-exercise-catalog.js";
import * as addProgressionIncrement from "./005-add-progression-increment.js";
import * as addDipPowerTower from "./006-add-dip-power-tower.js";
import * as addCurlPancaScott from "./007-add-curl-panca-scott.js";
import * as addAbWheelESollevamentoGinocchia from "./008-add-ab-wheel-e-sollevamento-ginocchia.js";
import * as fixSollevamentoGinocchiaCase from "./009-fix-sollevamento-ginocchia-case.js";
import * as addEserciziStoricoImport from "./010-add-esercizi-storico-import.js";
import * as addWorkoutPosition from "./011-add-workout-position.js";
import * as addMinMaxReps from "./012-add-min-max-reps.js";
import * as addRestMinMaxSeconds from "./013-add-rest-min-max-seconds.js";

/**
 * Registro statico delle migrazioni (chiavi ordinate). Preferito a
 * FileMigrationProvider per evitare differenze di risoluzione path tra
 * sorgenti (tsx) e output compilato (ESM in dist).
 */
export const migrations: Record<string, Migration> = {
  "001-create-workout-tables": createWorkoutTables,
  "002-seed-exercises": seedExercises,
  "003-add-exercise-metadata-and-rest": addExerciseMetadataAndRest,
  "004-enrich-exercise-catalog": enrichExerciseCatalog,
  "005-add-progression-increment": addProgressionIncrement,
  "006-add-dip-power-tower": addDipPowerTower,
  "007-add-curl-panca-scott": addCurlPancaScott,
  "008-add-ab-wheel-e-sollevamento-ginocchia": addAbWheelESollevamentoGinocchia,
  "009-fix-sollevamento-ginocchia-case": fixSollevamentoGinocchiaCase,
  "010-add-esercizi-storico-import": addEserciziStoricoImport,
  "011-add-workout-position": addWorkoutPosition,
  "012-add-min-max-reps": addMinMaxReps,
  "013-add-rest-min-max-seconds": addRestMinMaxSeconds,
};

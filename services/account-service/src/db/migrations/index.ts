import type { Migration } from "kysely";
import * as createUsers from "./001-create-users.js";
import * as addPasswordActionTokens from "./002-add-password-action-tokens.js";
import * as addUserMeasurements from "./003-add-user-measurements.js";
import * as addAccountPreferences from "./004-add-account-preferences.js";
import * as measurementHistory from "./005-measurement-history.js";

/**
 * Registro statico delle migrazioni. Preferito a FileMigrationProvider perche'
 * evita la risoluzione di path/dynamic import diversa tra sorgenti (tsx) e
 * output compilato (ESM in dist). Le chiavi ordinano l'esecuzione.
 *
 * `005-measurement-history` non ha una dipendenza DDL da history-service
 * (altera solo tabelle locali): il consumer di `measurement-save-requested`
 * in history-service deve pero' essere in esecuzione (con la propria
 * migrazione `001-add-measurement-entries` gia' applicata) prima che un
 * utente salvi davvero delle misure, altrimenti l'evento resta in retry
 * finche' la tabella non esiste.
 */
export const migrations: Record<string, Migration> = {
  "001-create-users": createUsers,
  "002-add-password-action-tokens": addPasswordActionTokens,
  "003-add-user-measurements": addUserMeasurements,
  "004-add-account-preferences": addAccountPreferences,
  "005-measurement-history": measurementHistory,
};

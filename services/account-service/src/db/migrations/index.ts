import type { Migration } from "kysely";
import * as createUsers from "./001-create-users.js";
import * as addPasswordActionTokens from "./002-add-password-action-tokens.js";

/**
 * Registro statico delle migrazioni. Preferito a FileMigrationProvider perche'
 * evita la risoluzione di path/dynamic import diversa tra sorgenti (tsx) e
 * output compilato (ESM in dist). Le chiavi ordinano l'esecuzione.
 */
export const migrations: Record<string, Migration> = {
  "001-create-users": createUsers,
  "002-add-password-action-tokens": addPasswordActionTokens,
};

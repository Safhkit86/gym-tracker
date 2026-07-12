import { Migrator } from "kysely";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { migrations } from "./migrations/index.js";

/**
 * Applica tutte le migrazioni pendenti fino all'ultima.
 * Eseguito esplicitamente (`npm run db:migrate`), non all'avvio del servizio.
 */
async function migrateToLatest(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  const db = createDb(DATABASE_URL);

  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === "Success") {
      // eslint-disable-next-line no-console
      console.log(`[migrate] applicata: ${result.migrationName}`);
    } else if (result.status === "Error") {
      // eslint-disable-next-line no-console
      console.error(`[migrate] fallita: ${result.migrationName}`);
    }
  }

  await db.destroy();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[migrate] errore durante la migrazione:", error);
    process.exit(1);
  }
}

void migrateToLatest();

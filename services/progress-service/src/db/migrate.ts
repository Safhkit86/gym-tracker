import { Migrator } from "kysely";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { migrations } from "./migrations/index.js";

async function migrateToLatest(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  const db = createDb(DATABASE_URL);

  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
    // Namespace per servizio: piu' servizi condividono lo stesso database
    // Postgres (vedi docker-compose.yml), quindi la tabella di tracking di
    // Kysely (default "kysely_migration") deve avere un nome per servizio
    // per non collidere con quella di auth-service/workout-service.
    migrationTableName: "kysely_migration_progress",
    migrationLockTableName: "kysely_migration_lock_progress",
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

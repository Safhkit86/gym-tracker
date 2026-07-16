import { Migrator } from "kysely";
import { createLogger } from "@gym-tracker/shared";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { migrations } from "./migrations/index.js";

const logger = createLogger("notify-service");

async function migrateToLatest(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  const db = createDb(DATABASE_URL);

  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
    // Namespace per servizio: piu' servizi condividono lo stesso database
    // Postgres (vedi docker-compose.yml), quindi la tabella di tracking di
    // Kysely (default "kysely_migration") deve avere un nome per servizio
    // per non collidere con quella degli altri servizi.
    migrationTableName: "kysely_migration_notify",
    migrationLockTableName: "kysely_migration_lock_notify",
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === "Success") {
      logger.info({ migration: result.migrationName }, "migrazione applicata");
    } else if (result.status === "Error") {
      logger.error({ migration: result.migrationName }, "migrazione fallita");
    }
  }

  await db.destroy();

  if (error) {
    logger.error({ err: error }, "errore durante la migrazione");
    process.exit(1);
  }
}

void migrateToLatest();

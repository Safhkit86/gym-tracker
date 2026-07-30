import { type Kysely, sql } from "kysely";

/**
 * Rinomina owner_id in user_id su exercises/workouts: il valore e' sempre
 * stato il `sub` del JWT (mai una vera FK verso una tabella "owners"), quindi
 * "owner" era un nome fuorviante rispetto al dominio. Vedi l'analisi
 * architetturale (history-service/progress-service ridotto).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("exercises").renameColumn("owner_id", "user_id").execute();
  await db.schema.alterTable("workouts").renameColumn("owner_id", "user_id").execute();

  await sql`ALTER INDEX exercises_owner_name_unique RENAME TO exercises_user_name_unique`.execute(
    db
  );
  await sql`ALTER INDEX workouts_owner_idx RENAME TO workouts_user_idx`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER INDEX workouts_user_idx RENAME TO workouts_owner_idx`.execute(db);
  await sql`ALTER INDEX exercises_user_name_unique RENAME TO exercises_owner_name_unique`.execute(
    db
  );

  await db.schema.alterTable("workouts").renameColumn("user_id", "owner_id").execute();
  await db.schema.alterTable("exercises").renameColumn("user_id", "owner_id").execute();
}

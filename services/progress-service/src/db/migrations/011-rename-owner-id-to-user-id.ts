import { type Kysely, sql } from "kysely";

/**
 * Rinomina owner_id in user_id su tutte le tabelle di progress-service: il
 * valore e' sempre stato il `sub` del JWT (mai una vera FK), quindi "owner"
 * era un nome fuorviante rispetto al dominio. Vedi l'analisi architetturale
 * (history-service/progress-service ridotto).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("workout_sessions").renameColumn("owner_id", "user_id").execute();
  await db.schema.alterTable("progression_events").renameColumn("owner_id", "user_id").execute();
  await db.schema
    .alterTable("progression_preferences")
    .renameColumn("owner_id", "user_id")
    .execute();
  await db.schema.alterTable("progression_defaults").renameColumn("owner_id", "user_id").execute();

  await sql`ALTER INDEX workout_sessions_owner_idx RENAME TO workout_sessions_user_idx`.execute(db);
  await sql`ALTER INDEX workout_sessions_owner_workout_idx RENAME TO workout_sessions_user_workout_idx`.execute(
    db
  );
  await sql`ALTER INDEX progression_events_owner_created_idx RENAME TO progression_events_user_created_idx`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER INDEX progression_events_user_created_idx RENAME TO progression_events_owner_created_idx`.execute(
    db
  );
  await sql`ALTER INDEX workout_sessions_user_workout_idx RENAME TO workout_sessions_owner_workout_idx`.execute(
    db
  );
  await sql`ALTER INDEX workout_sessions_user_idx RENAME TO workout_sessions_owner_idx`.execute(db);

  await db.schema.alterTable("progression_defaults").renameColumn("user_id", "owner_id").execute();
  await db.schema
    .alterTable("progression_preferences")
    .renameColumn("user_id", "owner_id")
    .execute();
  await db.schema.alterTable("progression_events").renameColumn("user_id", "owner_id").execute();
  await db.schema.alterTable("workout_sessions").renameColumn("user_id", "owner_id").execute();
}

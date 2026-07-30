import { type Kysely, sql } from "kysely";

/**
 * Rinomina owner_id in user_id su notifications: il valore e' sempre stato
 * il `sub` del JWT (mai una vera FK), quindi "owner" era un nome fuorviante
 * rispetto al dominio. Vedi l'analisi architetturale (history-service/
 * progress-service ridotto).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("notifications").renameColumn("owner_id", "user_id").execute();

  await sql`ALTER INDEX notifications_owner_created_idx RENAME TO notifications_user_created_idx`.execute(
    db
  );
  await sql`ALTER INDEX notifications_owner_read_idx RENAME TO notifications_user_read_idx`.execute(
    db
  );
  await sql`ALTER INDEX notifications_owner_event_unique RENAME TO notifications_user_event_unique`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER INDEX notifications_user_event_unique RENAME TO notifications_owner_event_unique`.execute(
    db
  );
  await sql`ALTER INDEX notifications_user_read_idx RENAME TO notifications_owner_read_idx`.execute(
    db
  );
  await sql`ALTER INDEX notifications_user_created_idx RENAME TO notifications_owner_created_idx`.execute(
    db
  );

  await db.schema.alterTable("notifications").renameColumn("user_id", "owner_id").execute();
}

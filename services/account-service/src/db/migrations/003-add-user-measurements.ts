import { type Kysely, sql } from "kysely";

/**
 * Misure fisiche dell'atleta: solo il valore corrente (nessuno storico
 * richiesto), tutte opzionali. Una riga per utente, creata al primo
 * salvataggio (nessun backfill per gli utenti esistenti).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user_measurements")
    .addColumn("user_id", "uuid", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade")
    )
    .addColumn("height_cm", "integer")
    .addColumn("weight_kg", "numeric")
    .addColumn("chest_cm", "numeric")
    .addColumn("arm_cm", "numeric")
    .addColumn("waist_cm", "numeric")
    .addColumn("leg_cm", "numeric")
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("user_measurements").execute();
}

import { type Kysely, sql } from "kysely";

/**
 * Prima vera migrazione di history-service (finora aveva ereditato solo
 * tabelle fisicamente gia' esistenti, vedi db/types.ts). `measurement_entries`
 * e' lo storico datato di peso/petto/braccia/vita/gamba, alimentato in modo
 * asincrono da account-service (che non ne tiene piu' copia locale, vedi
 * measurement-events-consumer.ts). Un utente puo' avere una sola entry per
 * data: salvare di nuovo sulla stessa data aggiorna quella riga (upsert su
 * `UNIQUE(user_id, measured_on)`) invece di duplicarla.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("measurement_entries")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    /** Non FK: users vive in account-service (stesso DB fisico). */
    .addColumn("user_id", "uuid", (col) => col.notNull())
    .addColumn("measured_on", "date", (col) => col.notNull())
    .addColumn("weight_kg", "numeric")
    .addColumn("chest_cm", "numeric")
    .addColumn("arm_cm", "numeric")
    .addColumn("waist_cm", "numeric")
    .addColumn("leg_cm", "numeric")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("measurement_entries_user_id_measured_on_key", ["user_id", "measured_on"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("measurement_entries").execute();
}

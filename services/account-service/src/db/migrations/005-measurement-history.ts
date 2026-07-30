import type { Kysely } from "kysely";

/**
 * Storico misure (history-service, `measurement_entries`): peso/petto/
 * braccia/vita/gamba smettono di avere una copia "corrente" qui, restano
 * solo come storico datato nell'altro servizio (letto via cache Redis, vedi
 * repositories/measurement-cache.ts). Nessun backfill: i valori esistenti
 * non hanno una data affidabile associata (erano un semplice valore
 * corrente), l'utente reinserira' a mano uno storico reale con le date
 * corrette. Resta solo `height_cm`, l'unico valore davvero "corrente".
 *
 * `historicize_measurements`: se il form Misure mostra il selettore data
 * (permette di scegliere una data diversa da oggi) o lo nasconde (si salva
 * sempre su oggi) — non cambia il percorso di scrittura, vedi
 * AccountPreferences in @gym-tracker/shared.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("user_measurements")
    .dropColumn("weight_kg")
    .dropColumn("chest_cm")
    .dropColumn("arm_cm")
    .dropColumn("waist_cm")
    .dropColumn("leg_cm")
    .execute();

  await db.schema
    .alterTable("account_preferences")
    .addColumn("historicize_measurements", "boolean", (col) => col.notNull().defaultTo(true))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("account_preferences")
    .dropColumn("historicize_measurements")
    .execute();

  await db.schema
    .alterTable("user_measurements")
    .addColumn("weight_kg", "numeric")
    .addColumn("chest_cm", "numeric")
    .addColumn("arm_cm", "numeric")
    .addColumn("waist_cm", "numeric")
    .addColumn("leg_cm", "numeric")
    .execute();
}

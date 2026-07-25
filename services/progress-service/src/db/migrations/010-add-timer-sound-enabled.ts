import type { Kysely } from "kysely";

/**
 * Preferenza per il timer di recupero in Registra sessione (vedi
 * apps/web/src/hooks/useRestTimers.ts): se suonare o meno un allarme
 * quando il conto alla rovescia arriva a zero. Non riguarda il motore di
 * progressione, ma vive nella stessa tabella di prefillScope per lo stesso
 * motivo: e' una preferenza della UI di logging, non serve una tabella
 * dedicata per un solo booleano. Default disattivato: nessun suono a
 * sorpresa finche' l'utente non lo attiva esplicitamente.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("progression_preferences")
    .addColumn("timer_sound_enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("progression_preferences").dropColumn("timer_sound_enabled").execute();
}

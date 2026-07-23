import { type Kysely, sql } from "kysely";

/**
 * L'ordine degli esercizi in una sessione veniva derivato da
 * `ORDER BY created_at, set_number`: con piu' set di esercizi diversi
 * inseriti nella stessa transazione, i timestamp possono coincidere (o
 * comunque non riflettere l'ordine di invio), e set_number da solo non
 * disambigua tra esercizi diversi con lo stesso numero di set — risultato:
 * l'ordine mostrato non rispecchiava sempre quello registrato dal client.
 * position e' assegnata esplicitamente dal repository (indice nell'array
 * `exercises` della request), stesso identico valore su ogni set dello
 * stesso esercizio (denormalizzato, come progression_increment/rest_seconds).
 *
 * Backfill: DENSE_RANK per (session_id) su MIN(created_at) per esercizio —
 * ricostruisce l'ordine originale per le righe esistenti dove i timestamp
 * erano ancora distinti; dove non lo erano, l'ordine restera' quello che
 * gia' si vedeva (nessun peggioramento) finche' non corretto a mano.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").addColumn("position", "integer").execute();

  await sql`
    UPDATE session_sets ss
    SET position = sub.rn - 1
    FROM (
      SELECT session_id, exercise_id,
             DENSE_RANK() OVER (PARTITION BY session_id ORDER BY MIN(created_at)) AS rn
      FROM session_sets
      GROUP BY session_id, exercise_id
    ) sub
    WHERE ss.session_id = sub.session_id AND ss.exercise_id = sub.exercise_id
  `.execute(db);

  await db.schema.alterTable("session_sets").alterColumn("position", (col) => col.setNotNull()).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("session_sets").dropColumn("position").execute();
}

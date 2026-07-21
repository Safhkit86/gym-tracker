import { type Kysely, sql } from "kysely";

/**
 * La migration 008 aveva inserito "Sollevamento Ginocchia" (G maiuscola):
 * corretto in "Sollevamento ginocchia" per coerenza con la convenzione del
 * catalogo (solo la prima parola maiuscola, es. "Sollevamento gambe").
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE exercises SET name = 'Sollevamento ginocchia' WHERE owner_id IS NULL AND name = 'Sollevamento Ginocchia'`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE exercises SET name = 'Sollevamento Ginocchia' WHERE owner_id IS NULL AND name = 'Sollevamento ginocchia'`.execute(
    db
  );
}

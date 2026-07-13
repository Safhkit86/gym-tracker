import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types.js";

/**
 * Crea un'istanza Kysely su un pool di connessioni Postgres.
 * Il chiamante e' responsabile di chiuderla con `db.destroy()`.
 */
export function createDb(connectionString: string): Kysely<Database> {
  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString }),
  });
  return new Kysely<Database>({ dialect });
}

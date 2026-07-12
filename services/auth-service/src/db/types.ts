import type { ColumnType, Generated } from "kysely";

/**
 * Tipi delle tabelle per Kysely. Con Kysely il "database schema" e' definito
 * qui a mano (unica fonte di verita' lato tipi); le migrazioni SQL vivono in
 * ./migrations e devono restare allineate a queste interfacce.
 */
export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  created_at: Generated<Date>;
  // Scrivibile su update, ma con default a livello DB in insert.
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface Database {
  users: UsersTable;
}

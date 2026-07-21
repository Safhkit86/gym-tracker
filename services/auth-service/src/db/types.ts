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
  password_changed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export type PasswordActionPurpose = "reset" | "change";

export interface PasswordActionTokensTable {
  id: Generated<string>;
  user_id: string;
  purpose: PasswordActionPurpose;
  token_hash: string;
  pending_password_hash: string | null;
  attempts: Generated<number>;
  expires_at: Date;
  used_at: Date | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  password_action_tokens: PasswordActionTokensTable;
}

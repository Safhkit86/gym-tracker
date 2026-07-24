import type { ColumnType, Generated } from "kysely";

/**
 * Tipi delle tabelle per Kysely. Con Kysely il "database schema" e' definito
 * qui a mano (unica fonte di verita' lato tipi); le migrazioni SQL vivono in
 * ./migrations e devono restare allineate a queste interfacce.
 *
 * Nota: le colonne `numeric` di user_measurements (weight_kg/chest_cm/
 * arm_cm/waist_cm/leg_cm) tornano da node-pg come stringa, quindi in select
 * sono `string | null`; in insert/update accettiamo `number | null` (stesso
 * trattamento di target_weight in workout-service).
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

export interface UserMeasurementsTable {
  user_id: string;
  height_cm: number | null;
  weight_kg: ColumnType<string | null, number | null, number | null>;
  chest_cm: ColumnType<string | null, number | null, number | null>;
  arm_cm: ColumnType<string | null, number | null, number | null>;
  waist_cm: ColumnType<string | null, number | null, number | null>;
  leg_cm: ColumnType<string | null, number | null, number | null>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface Database {
  users: UsersTable;
  password_action_tokens: PasswordActionTokensTable;
  user_measurements: UserMeasurementsTable;
}

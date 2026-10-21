import type { Kysely } from "kysely";

/**
 * Lockout per account dopo troppi login falliti consecutivi (vedi
 * MAX_FAILED_LOGIN_ATTEMPTS/LOCKOUT_DURATION_MS in auth-service.ts): il
 * rate limit del gateway e' per IP, non per account — un attacco a bassa
 * frequenza distribuito su molti IP contro un singolo account non veniva mai
 * bloccato. `failed_login_attempts` e `locked_until` vivono su `users`
 * (non una tabella a parte): un solo aggiornamento atomico per tentativo
 * (vedi KyselyUserRepository.incrementFailedLoginAttempts), niente join.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("failed_login_attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("locked_until", "timestamptz")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .dropColumn("failed_login_attempts")
    .dropColumn("locked_until")
    .execute();
}

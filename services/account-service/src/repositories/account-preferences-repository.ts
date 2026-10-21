import type { Kysely } from "kysely";
import type { Database, PrefillScope } from "../db/types.js";

export interface AccountPreferencesRecord {
  prefillScope: PrefillScope;
  timerSoundEnabled: boolean;
  historicizeMeasurements: boolean;
}

const DEFAULT_PREFERENCES: AccountPreferencesRecord = {
  prefillScope: "workout",
  timerSoundEnabled: false,
  historicizeMeasurements: true,
};

export interface AccountPreferencesRepository {
  /** I default se l'utente non ha ancora salvato nulla (nessun backfill richiesto). */
  find(userId: string): Promise<AccountPreferencesRecord>;
  upsert(userId: string, values: AccountPreferencesRecord): Promise<AccountPreferencesRecord>;
  /** Usato da AccountDeletionService: esplicito invece di fare affidamento
   *  solo sulla FK ON DELETE CASCADE di account_preferences.user_id (vedi
   *  migrazione 004), vedi stesso commento in
   *  user-measurements-repository.ts. */
  delete(userId: string): Promise<void>;
}

/** Implementazione su Postgres via Kysely. */
export class KyselyAccountPreferencesRepository implements AccountPreferencesRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(userId: string): Promise<AccountPreferencesRecord> {
    const row = await this.db
      .selectFrom("account_preferences")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!row) {
      return DEFAULT_PREFERENCES;
    }
    return {
      prefillScope: row.prefill_scope,
      timerSoundEnabled: row.timer_sound_enabled,
      historicizeMeasurements: row.historicize_measurements,
    };
  }

  async upsert(
    userId: string,
    values: AccountPreferencesRecord
  ): Promise<AccountPreferencesRecord> {
    const row = await this.db
      .insertInto("account_preferences")
      .values({
        user_id: userId,
        prefill_scope: values.prefillScope,
        timer_sound_enabled: values.timerSoundEnabled,
        historicize_measurements: values.historicizeMeasurements,
      })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          prefill_scope: values.prefillScope,
          timer_sound_enabled: values.timerSoundEnabled,
          historicize_measurements: values.historicizeMeasurements,
          updated_at: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      prefillScope: row.prefill_scope,
      timerSoundEnabled: row.timer_sound_enabled,
      historicizeMeasurements: row.historicize_measurements,
    };
  }

  async delete(userId: string): Promise<void> {
    await this.db.deleteFrom("account_preferences").where("user_id", "=", userId).execute();
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryAccountPreferencesRepository implements AccountPreferencesRepository {
  private readonly byUserId = new Map<string, AccountPreferencesRecord>();

  async find(userId: string): Promise<AccountPreferencesRecord> {
    return this.byUserId.get(userId) ?? DEFAULT_PREFERENCES;
  }

  async upsert(
    userId: string,
    values: AccountPreferencesRecord
  ): Promise<AccountPreferencesRecord> {
    this.byUserId.set(userId, values);
    return values;
  }

  async delete(userId: string): Promise<void> {
    this.byUserId.delete(userId);
  }
}

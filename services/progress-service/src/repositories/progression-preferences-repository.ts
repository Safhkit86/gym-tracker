import type { Kysely } from "kysely";
import type { Database, GroupingScope } from "../db/types.js";

export interface ProgressionPreferencesRecord {
  requiredConsecutiveSessions: number;
  groupingScope: GroupingScope;
  prefillScope: GroupingScope;
  timerSoundEnabled: boolean;
}

const DEFAULT_PREFERENCES: ProgressionPreferencesRecord = {
  requiredConsecutiveSessions: 2,
  groupingScope: "workout",
  prefillScope: "workout",
  timerSoundEnabled: false,
};

export interface ProgressionPreferencesRepository {
  /** I default se l'utente non ha ancora salvato nulla (nessun backfill richiesto). */
  find(userId: string): Promise<ProgressionPreferencesRecord>;
  upsert(
    userId: string,
    values: ProgressionPreferencesRecord
  ): Promise<ProgressionPreferencesRecord>;
}

/** Implementazione su Postgres via Kysely. */
export class KyselyProgressionPreferencesRepository implements ProgressionPreferencesRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(userId: string): Promise<ProgressionPreferencesRecord> {
    const row = await this.db
      .selectFrom("progression_preferences")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!row) {
      return DEFAULT_PREFERENCES;
    }
    return {
      requiredConsecutiveSessions: row.required_consecutive_sessions,
      groupingScope: row.grouping_scope,
      prefillScope: row.prefill_scope,
      timerSoundEnabled: row.timer_sound_enabled,
    };
  }

  async upsert(
    userId: string,
    values: ProgressionPreferencesRecord
  ): Promise<ProgressionPreferencesRecord> {
    const row = await this.db
      .insertInto("progression_preferences")
      .values({
        user_id: userId,
        required_consecutive_sessions: values.requiredConsecutiveSessions,
        grouping_scope: values.groupingScope,
        prefill_scope: values.prefillScope,
        timer_sound_enabled: values.timerSoundEnabled,
      })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          required_consecutive_sessions: values.requiredConsecutiveSessions,
          grouping_scope: values.groupingScope,
          prefill_scope: values.prefillScope,
          timer_sound_enabled: values.timerSoundEnabled,
          updated_at: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      requiredConsecutiveSessions: row.required_consecutive_sessions,
      groupingScope: row.grouping_scope,
      prefillScope: row.prefill_scope,
      timerSoundEnabled: row.timer_sound_enabled,
    };
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryProgressionPreferencesRepository implements ProgressionPreferencesRepository {
  private readonly byOwnerId = new Map<string, ProgressionPreferencesRecord>();

  async find(userId: string): Promise<ProgressionPreferencesRecord> {
    return this.byOwnerId.get(userId) ?? DEFAULT_PREFERENCES;
  }

  async upsert(
    userId: string,
    values: ProgressionPreferencesRecord
  ): Promise<ProgressionPreferencesRecord> {
    this.byOwnerId.set(userId, values);
    return values;
  }
}

import type { Kysely } from "kysely";
import type { Database, GroupingScope } from "../db/types.js";

export interface ProgressionPreferencesRecord {
  requiredConsecutiveSessions: number;
  groupingScope: GroupingScope;
}

const DEFAULT_PREFERENCES: ProgressionPreferencesRecord = {
  requiredConsecutiveSessions: 2,
  groupingScope: "workout",
};

export interface ProgressionPreferencesRepository {
  /** I default se l'utente non ha ancora salvato nulla (nessun backfill richiesto). */
  find(ownerId: string): Promise<ProgressionPreferencesRecord>;
  upsert(
    ownerId: string,
    values: ProgressionPreferencesRecord
  ): Promise<ProgressionPreferencesRecord>;
}

/** Implementazione su Postgres via Kysely. */
export class KyselyProgressionPreferencesRepository implements ProgressionPreferencesRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(ownerId: string): Promise<ProgressionPreferencesRecord> {
    const row = await this.db
      .selectFrom("progression_preferences")
      .selectAll()
      .where("owner_id", "=", ownerId)
      .executeTakeFirst();
    if (!row) {
      return DEFAULT_PREFERENCES;
    }
    return {
      requiredConsecutiveSessions: row.required_consecutive_sessions,
      groupingScope: row.grouping_scope,
    };
  }

  async upsert(
    ownerId: string,
    values: ProgressionPreferencesRecord
  ): Promise<ProgressionPreferencesRecord> {
    const row = await this.db
      .insertInto("progression_preferences")
      .values({
        owner_id: ownerId,
        required_consecutive_sessions: values.requiredConsecutiveSessions,
        grouping_scope: values.groupingScope,
      })
      .onConflict((oc) =>
        oc.column("owner_id").doUpdateSet({
          required_consecutive_sessions: values.requiredConsecutiveSessions,
          grouping_scope: values.groupingScope,
          updated_at: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      requiredConsecutiveSessions: row.required_consecutive_sessions,
      groupingScope: row.grouping_scope,
    };
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryProgressionPreferencesRepository implements ProgressionPreferencesRepository {
  private readonly byOwnerId = new Map<string, ProgressionPreferencesRecord>();

  async find(ownerId: string): Promise<ProgressionPreferencesRecord> {
    return this.byOwnerId.get(ownerId) ?? DEFAULT_PREFERENCES;
  }

  async upsert(
    ownerId: string,
    values: ProgressionPreferencesRecord
  ): Promise<ProgressionPreferencesRecord> {
    this.byOwnerId.set(ownerId, values);
    return values;
  }
}

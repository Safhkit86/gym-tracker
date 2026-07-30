import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

/**
 * Solo `heightCm`: l'unico valore davvero "corrente" (nessuno storico ha
 * senso per l'altezza). Peso/petto/braccia/vita/gamba sono storicizzati in
 * history-service (`measurement_entries`) e letti qui via cache Redis, vedi
 * measurement-cache-repository.ts e measurements-routes.ts.
 */
export interface UserHeight {
  heightCm: number | null;
}

const EMPTY_HEIGHT: UserHeight = { heightCm: null };

export interface UserMeasurementsRepository {
  /** `heightCm: null` se l'utente non ha ancora salvato nulla. */
  find(userId: string): Promise<UserHeight>;
  upsert(userId: string, values: UserHeight): Promise<UserHeight>;
}

/** Implementazione su Postgres via Kysely. */
export class KyselyUserMeasurementsRepository implements UserMeasurementsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(userId: string): Promise<UserHeight> {
    const row = await this.db
      .selectFrom("user_measurements")
      .select("height_cm")
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? { heightCm: row.height_cm } : EMPTY_HEIGHT;
  }

  async upsert(userId: string, values: UserHeight): Promise<UserHeight> {
    const row = await this.db
      .insertInto("user_measurements")
      .values({ user_id: userId, height_cm: values.heightCm })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          height_cm: values.heightCm,
          updated_at: new Date(),
        })
      )
      .returning("height_cm")
      .executeTakeFirstOrThrow();
    return { heightCm: row.height_cm };
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryUserMeasurementsRepository implements UserMeasurementsRepository {
  private readonly byUserId = new Map<string, UserHeight>();

  async find(userId: string): Promise<UserHeight> {
    return this.byUserId.get(userId) ?? EMPTY_HEIGHT;
  }

  async upsert(userId: string, values: UserHeight): Promise<UserHeight> {
    this.byUserId.set(userId, values);
    return values;
  }
}

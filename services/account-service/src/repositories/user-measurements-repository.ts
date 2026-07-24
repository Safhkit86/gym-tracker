import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

export interface UserMeasurements {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
}

const EMPTY_MEASUREMENTS: UserMeasurements = {
  heightCm: null,
  weightKg: null,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
};

export interface UserMeasurementsRepository {
  /** Tutti i campi `null` se l'utente non ha ancora salvato nulla. */
  find(userId: string): Promise<UserMeasurements>;
  upsert(userId: string, values: UserMeasurements): Promise<UserMeasurements>;
}

interface UserMeasurementsRow {
  height_cm: number | null;
  weight_kg: string | null;
  chest_cm: string | null;
  arm_cm: string | null;
  waist_cm: string | null;
  leg_cm: string | null;
}

function toRecord(row: UserMeasurementsRow): UserMeasurements {
  return {
    heightCm: row.height_cm,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    chestCm: row.chest_cm === null ? null : Number(row.chest_cm),
    armCm: row.arm_cm === null ? null : Number(row.arm_cm),
    waistCm: row.waist_cm === null ? null : Number(row.waist_cm),
    legCm: row.leg_cm === null ? null : Number(row.leg_cm),
  };
}

/** Implementazione su Postgres via Kysely. */
export class KyselyUserMeasurementsRepository implements UserMeasurementsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(userId: string): Promise<UserMeasurements> {
    const row = await this.db
      .selectFrom("user_measurements")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? toRecord(row) : EMPTY_MEASUREMENTS;
  }

  async upsert(userId: string, values: UserMeasurements): Promise<UserMeasurements> {
    const row = await this.db
      .insertInto("user_measurements")
      .values({
        user_id: userId,
        height_cm: values.heightCm,
        weight_kg: values.weightKg,
        chest_cm: values.chestCm,
        arm_cm: values.armCm,
        waist_cm: values.waistCm,
        leg_cm: values.legCm,
      })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          height_cm: values.heightCm,
          weight_kg: values.weightKg,
          chest_cm: values.chestCm,
          arm_cm: values.armCm,
          waist_cm: values.waistCm,
          leg_cm: values.legCm,
          updated_at: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryUserMeasurementsRepository implements UserMeasurementsRepository {
  private readonly byUserId = new Map<string, UserMeasurements>();

  async find(userId: string): Promise<UserMeasurements> {
    return this.byUserId.get(userId) ?? EMPTY_MEASUREMENTS;
  }

  async upsert(userId: string, values: UserMeasurements): Promise<UserMeasurements> {
    this.byUserId.set(userId, values);
    return values;
  }
}

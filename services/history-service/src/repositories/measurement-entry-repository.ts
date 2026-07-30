import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { MeasurementEntry } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";

export interface MeasurementValues {
  weightKg: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
}

export interface MeasurementEntryRepository {
  /** Upsert su (userId, measuredOn): salvare di nuovo sulla stessa data
   *  aggiorna l'entry esistente invece di duplicarla. */
  upsert(userId: string, measuredOn: string, values: MeasurementValues): Promise<MeasurementEntry>;
  /** Piu' recenti prima. */
  listByOwner(userId: string): Promise<MeasurementEntry[]>;
  delete(userId: string, id: string): Promise<boolean>;
}

function toEntry(row: {
  id: string;
  measured_on: Date;
  weight_kg: string | null;
  chest_cm: string | null;
  arm_cm: string | null;
  waist_cm: string | null;
  leg_cm: string | null;
  created_at: Date;
  updated_at: Date;
}): MeasurementEntry {
  return {
    id: row.id,
    measuredOn: row.measured_on.toISOString().slice(0, 10),
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    chestCm: row.chest_cm === null ? null : Number(row.chest_cm),
    armCm: row.arm_cm === null ? null : Number(row.arm_cm),
    waistCm: row.waist_cm === null ? null : Number(row.waist_cm),
    legCm: row.leg_cm === null ? null : Number(row.leg_cm),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Implementazione su Postgres via Kysely. */
export class KyselyMeasurementEntryRepository implements MeasurementEntryRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async upsert(
    userId: string,
    measuredOn: string,
    values: MeasurementValues
  ): Promise<MeasurementEntry> {
    const columns = {
      weight_kg: values.weightKg,
      chest_cm: values.chestCm,
      arm_cm: values.armCm,
      waist_cm: values.waistCm,
      leg_cm: values.legCm,
    };
    const row = await this.db
      .insertInto("measurement_entries")
      .values({ user_id: userId, measured_on: measuredOn, ...columns })
      .onConflict((oc) =>
        oc.columns(["user_id", "measured_on"]).doUpdateSet({ ...columns, updated_at: new Date() })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntry(row);
  }

  async listByOwner(userId: string): Promise<MeasurementEntry[]> {
    const rows = await this.db
      .selectFrom("measurement_entries")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("measured_on", "desc")
      .execute();
    return rows.map(toEntry);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("measurement_entries")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
    return (result[0]?.numDeletedRows ?? 0n) > 0n;
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryMeasurementEntryRepository implements MeasurementEntryRepository {
  private readonly byId = new Map<string, MeasurementEntry & { userId: string }>();

  async upsert(
    userId: string,
    measuredOn: string,
    values: MeasurementValues
  ): Promise<MeasurementEntry> {
    const existing = [...this.byId.values()].find(
      (e) => e.userId === userId && e.measuredOn === measuredOn
    );
    const now = new Date().toISOString();
    const stored = {
      id: existing?.id ?? randomUUID(),
      userId,
      measuredOn,
      weightKg: values.weightKg,
      chestCm: values.chestCm,
      armCm: values.armCm,
      waistCm: values.waistCm,
      legCm: values.legCm,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.byId.set(stored.id, stored);
    return stripUserId(stored);
  }

  async listByOwner(userId: string): Promise<MeasurementEntry[]> {
    return [...this.byId.values()]
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))
      .map(stripUserId);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const stored = this.byId.get(id);
    if (!stored || stored.userId !== userId) {
      return false;
    }
    this.byId.delete(id);
    return true;
  }
}

function stripUserId(stored: MeasurementEntry & { userId: string }): MeasurementEntry {
  return {
    id: stored.id,
    measuredOn: stored.measuredOn,
    weightKg: stored.weightKg,
    chestCm: stored.chestCm,
    armCm: stored.armCm,
    waistCm: stored.waistCm,
    legCm: stored.legCm,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

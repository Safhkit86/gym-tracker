import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { ProgressionSuggestionType } from "@gym-tracker/shared";

export interface ProgressionDefaultRecord {
  exerciseId: string;
  suggestionType: ProgressionSuggestionType;
  value: number;
}

export interface ProgressionDefaultsRepository {
  listByOwner(userId: string): Promise<ProgressionDefaultRecord[]>;
  upsertMany(userId: string, overrides: ProgressionDefaultRecord[]): Promise<void>;
  /** No-op se non esiste una riga pendente per quell'esercizio. */
  consume(userId: string, exerciseId: string): Promise<void>;
}

/** Implementazione su Postgres via Kysely. */
export class KyselyProgressionDefaultsRepository implements ProgressionDefaultsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async listByOwner(userId: string): Promise<ProgressionDefaultRecord[]> {
    const rows = await this.db
      .selectFrom("progression_defaults")
      .selectAll()
      .where("user_id", "=", userId)
      .execute();
    return rows.map((row) => ({
      exerciseId: row.exercise_id,
      suggestionType: row.suggestion_type as ProgressionSuggestionType,
      value: Number(row.value),
    }));
  }

  async upsertMany(userId: string, overrides: ProgressionDefaultRecord[]): Promise<void> {
    for (const override of overrides) {
      await this.db
        .insertInto("progression_defaults")
        .values({
          user_id: userId,
          exercise_id: override.exerciseId,
          suggestion_type: override.suggestionType,
          value: override.value,
        })
        .onConflict((oc) =>
          oc.columns(["user_id", "exercise_id"]).doUpdateSet({
            suggestion_type: override.suggestionType,
            value: override.value,
            created_at: new Date(),
          })
        )
        .execute();
    }
  }

  async consume(userId: string, exerciseId: string): Promise<void> {
    await this.db
      .deleteFrom("progression_defaults")
      .where("user_id", "=", userId)
      .where("exercise_id", "=", exerciseId)
      .execute();
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryProgressionDefaultsRepository implements ProgressionDefaultsRepository {
  private readonly byOwnerAndExercise = new Map<string, ProgressionDefaultRecord>();

  private key(userId: string, exerciseId: string): string {
    return `${userId}:${exerciseId}`;
  }

  async listByOwner(userId: string): Promise<ProgressionDefaultRecord[]> {
    return [...this.byOwnerAndExercise.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, record]) => record);
  }

  async upsertMany(userId: string, overrides: ProgressionDefaultRecord[]): Promise<void> {
    for (const override of overrides) {
      this.byOwnerAndExercise.set(this.key(userId, override.exerciseId), override);
    }
  }

  async consume(userId: string, exerciseId: string): Promise<void> {
    this.byOwnerAndExercise.delete(this.key(userId, exerciseId));
  }
}

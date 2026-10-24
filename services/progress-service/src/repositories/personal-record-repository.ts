import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import {
  EMPTY_PERSONAL_RECORD_STATE,
  type PersonalRecordState,
} from "../domain/personal-record-detector.js";

export interface PersonalRecordRepository {
  /** EMPTY_PERSONAL_RECORD_STATE se l'esercizio non ha ancora nessun record
   *  (mai confrontato prima). */
  findByUserAndExercise(userId: string, exerciseId: string): Promise<PersonalRecordState>;
  upsert(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    state: PersonalRecordState
  ): Promise<void>;
  /** Usato dal consumer di user-deleted-progress (cancellazione account, GDPR). */
  deleteAllForUser(userId: string): Promise<void>;
}

export class KyselyPersonalRecordRepository implements PersonalRecordRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByUserAndExercise(userId: string, exerciseId: string): Promise<PersonalRecordState> {
    const row = await this.db
      .selectFrom("personal_records")
      .selectAll()
      .where("user_id", "=", userId)
      .where("exercise_id", "=", exerciseId)
      .executeTakeFirst();
    if (!row) {
      return EMPTY_PERSONAL_RECORD_STATE;
    }
    return {
      bestWeight: row.best_weight === null ? null : Number(row.best_weight),
      bestWeightReps: row.best_weight_reps,
      bestBodyweightReps: row.best_bodyweight_reps,
    };
  }

  async upsert(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    state: PersonalRecordState
  ): Promise<void> {
    await this.db
      .insertInto("personal_records")
      .values({
        user_id: userId,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        best_weight: state.bestWeight,
        best_weight_reps: state.bestWeightReps,
        best_bodyweight_reps: state.bestBodyweightReps,
      })
      .onConflict((oc) =>
        oc.columns(["user_id", "exercise_id"]).doUpdateSet({
          exercise_name: exerciseName,
          best_weight: state.bestWeight,
          best_weight_reps: state.bestWeightReps,
          best_bodyweight_reps: state.bestBodyweightReps,
          updated_at: new Date(),
        })
      )
      .execute();
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.deleteFrom("personal_records").where("user_id", "=", userId).execute();
  }
}

/** Implementazione in memoria per i test. */
export class InMemoryPersonalRecordRepository implements PersonalRecordRepository {
  private readonly byKey = new Map<string, PersonalRecordState>();

  private key(userId: string, exerciseId: string): string {
    return `${userId}:${exerciseId}`;
  }

  async findByUserAndExercise(userId: string, exerciseId: string): Promise<PersonalRecordState> {
    return this.byKey.get(this.key(userId, exerciseId)) ?? EMPTY_PERSONAL_RECORD_STATE;
  }

  async upsert(
    userId: string,
    exerciseId: string,
    _exerciseName: string,
    state: PersonalRecordState
  ): Promise<void> {
    this.byKey.set(this.key(userId, exerciseId), state);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const key of this.byKey.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.byKey.delete(key);
      }
    }
  }
}

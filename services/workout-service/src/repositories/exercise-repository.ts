import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { ConflictError } from "../errors.js";

export interface ExerciseRecord {
  id: string;
  userId: string | null;
  name: string;
  muscleGroup: string | null;
  description: string | null;
  sourceUrl: string | null;
}

export interface NewExercise {
  userId: string;
  name: string;
  muscleGroup: string | null;
}

export interface ExerciseRepository {
  /** Esercizi globali + quelli dell'utente, ordinati per nome. */
  listAvailable(userId: string): Promise<ExerciseRecord[]>;
  /** Sottoinsieme di `ids` accessibile all'utente (globali o propri). */
  findAccessibleByIds(userId: string, ids: string[]): Promise<ExerciseRecord[]>;
  create(exercise: NewExercise): Promise<ExerciseRecord>;
  /** Cancella solo gli esercizi CUSTOM dell'utente (user_id = userId, mai i
   *  globali con user_id null): va chiamato dopo aver cancellato le schede
   *  dell'utente (ExerciseRepository.exercise_id ha ON DELETE RESTRICT verso
   *  workout_exercises, vedi migrazione 001 — con le schede gia' sparite
   *  non ci sono piu' righe a bloccare la cancellazione). Usato dal
   *  consumer di user-deleted-workout (cancellazione account, GDPR). */
  deleteAllCustomForUser(userId: string): Promise<void>;
}

interface ExerciseRow {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string | null;
  description: string | null;
  source_url: string | null;
}

function toRecord(row: ExerciseRow): ExerciseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    description: row.description,
    sourceUrl: row.source_url,
  };
}

/** True se l'errore e' una violazione di unique constraint Postgres. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export class KyselyExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async listAvailable(userId: string): Promise<ExerciseRecord[]> {
    const rows = await this.db
      .selectFrom("exercises")
      .select(["id", "user_id", "name", "muscle_group", "description", "source_url"])
      .where((eb) => eb.or([eb("user_id", "is", null), eb("user_id", "=", userId)]))
      .orderBy("name")
      .execute();
    return rows.map(toRecord);
  }

  async findAccessibleByIds(userId: string, ids: string[]): Promise<ExerciseRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("exercises")
      .select(["id", "user_id", "name", "muscle_group", "description", "source_url"])
      .where("id", "in", ids)
      .where((eb) => eb.or([eb("user_id", "is", null), eb("user_id", "=", userId)]))
      .execute();
    return rows.map(toRecord);
  }

  async create(exercise: NewExercise): Promise<ExerciseRecord> {
    try {
      const row = await this.db
        .insertInto("exercises")
        .values({
          user_id: exercise.userId,
          name: exercise.name,
          muscle_group: exercise.muscleGroup,
        })
        .returning(["id", "user_id", "name", "muscle_group", "description", "source_url"])
        .executeTakeFirstOrThrow();
      return toRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          "EXERCISE_ALREADY_EXISTS",
          "Hai gia' un esercizio con questo nome."
        );
      }
      throw err;
    }
  }

  async deleteAllCustomForUser(userId: string): Promise<void> {
    await this.db.deleteFrom("exercises").where("user_id", "=", userId).execute();
  }
}

/** Implementazione in memoria per i test. Include il catalogo globale seed. */
export class InMemoryExerciseRepository implements ExerciseRepository {
  private readonly byId = new Map<string, ExerciseRecord>();

  constructor(seedGlobals: ReadonlyArray<{ name: string; muscleGroup: string | null }> = []) {
    for (const g of seedGlobals) {
      const record: ExerciseRecord = {
        id: randomUUID(),
        userId: null,
        name: g.name,
        muscleGroup: g.muscleGroup,
        description: null,
        sourceUrl: null,
      };
      this.byId.set(record.id, record);
    }
  }

  async listAvailable(userId: string): Promise<ExerciseRecord[]> {
    return [...this.byId.values()]
      .filter((e) => e.userId === null || e.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findAccessibleByIds(userId: string, ids: string[]): Promise<ExerciseRecord[]> {
    const wanted = new Set(ids);
    return [...this.byId.values()].filter(
      (e) => wanted.has(e.id) && (e.userId === null || e.userId === userId)
    );
  }

  async create(exercise: NewExercise): Promise<ExerciseRecord> {
    const duplicate = [...this.byId.values()].some(
      (e) => e.userId === exercise.userId && e.name === exercise.name
    );
    if (duplicate) {
      throw new ConflictError("EXERCISE_ALREADY_EXISTS", "Hai gia' un esercizio con questo nome.");
    }
    const record: ExerciseRecord = {
      id: randomUUID(),
      userId: exercise.userId,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      description: null,
      sourceUrl: null,
    };
    this.byId.set(record.id, record);
    return record;
  }

  async deleteAllCustomForUser(userId: string): Promise<void> {
    for (const [id, exercise] of this.byId) {
      if (exercise.userId === userId) {
        this.byId.delete(id);
      }
    }
  }
}

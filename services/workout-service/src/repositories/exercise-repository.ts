import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { ConflictError } from "../errors.js";

export interface ExerciseRecord {
  id: string;
  ownerId: string | null;
  name: string;
  muscleGroup: string | null;
  description: string | null;
  sourceUrl: string | null;
}

export interface NewExercise {
  ownerId: string;
  name: string;
  muscleGroup: string | null;
}

export interface ExerciseRepository {
  /** Esercizi globali + quelli dell'utente, ordinati per nome. */
  listAvailable(ownerId: string): Promise<ExerciseRecord[]>;
  /** Sottoinsieme di `ids` accessibile all'utente (globali o propri). */
  findAccessibleByIds(ownerId: string, ids: string[]): Promise<ExerciseRecord[]>;
  create(exercise: NewExercise): Promise<ExerciseRecord>;
}

interface ExerciseRow {
  id: string;
  owner_id: string | null;
  name: string;
  muscle_group: string | null;
  description: string | null;
  source_url: string | null;
}

function toRecord(row: ExerciseRow): ExerciseRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
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

  async listAvailable(ownerId: string): Promise<ExerciseRecord[]> {
    const rows = await this.db
      .selectFrom("exercises")
      .select(["id", "owner_id", "name", "muscle_group", "description", "source_url"])
      .where((eb) => eb.or([eb("owner_id", "is", null), eb("owner_id", "=", ownerId)]))
      .orderBy("name")
      .execute();
    return rows.map(toRecord);
  }

  async findAccessibleByIds(ownerId: string, ids: string[]): Promise<ExerciseRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("exercises")
      .select(["id", "owner_id", "name", "muscle_group", "description", "source_url"])
      .where("id", "in", ids)
      .where((eb) => eb.or([eb("owner_id", "is", null), eb("owner_id", "=", ownerId)]))
      .execute();
    return rows.map(toRecord);
  }

  async create(exercise: NewExercise): Promise<ExerciseRecord> {
    try {
      const row = await this.db
        .insertInto("exercises")
        .values({
          owner_id: exercise.ownerId,
          name: exercise.name,
          muscle_group: exercise.muscleGroup,
        })
        .returning(["id", "owner_id", "name", "muscle_group", "description", "source_url"])
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
}

/** Implementazione in memoria per i test. Include il catalogo globale seed. */
export class InMemoryExerciseRepository implements ExerciseRepository {
  private readonly byId = new Map<string, ExerciseRecord>();

  constructor(seedGlobals: ReadonlyArray<{ name: string; muscleGroup: string | null }> = []) {
    for (const g of seedGlobals) {
      const record: ExerciseRecord = {
        id: randomUUID(),
        ownerId: null,
        name: g.name,
        muscleGroup: g.muscleGroup,
        description: null,
        sourceUrl: null,
      };
      this.byId.set(record.id, record);
    }
  }

  async listAvailable(ownerId: string): Promise<ExerciseRecord[]> {
    return [...this.byId.values()]
      .filter((e) => e.ownerId === null || e.ownerId === ownerId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findAccessibleByIds(ownerId: string, ids: string[]): Promise<ExerciseRecord[]> {
    const wanted = new Set(ids);
    return [...this.byId.values()].filter(
      (e) => wanted.has(e.id) && (e.ownerId === null || e.ownerId === ownerId)
    );
  }

  async create(exercise: NewExercise): Promise<ExerciseRecord> {
    const duplicate = [...this.byId.values()].some(
      (e) => e.ownerId === exercise.ownerId && e.name === exercise.name
    );
    if (duplicate) {
      throw new ConflictError("EXERCISE_ALREADY_EXISTS", "Hai gia' un esercizio con questo nome.");
    }
    const record: ExerciseRecord = {
      id: randomUUID(),
      ownerId: exercise.ownerId,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      description: null,
      sourceUrl: null,
    };
    this.byId.set(record.id, record);
    return record;
  }
}

import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type {
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSummary,
} from "@gym-tracker/shared";
import { NotFoundError } from "../errors.js";
import type { Database } from "../db/types.js";

// --- Input normalizzato dal domain (owner gia' validato, esercizi risolti) ---

export interface NormalizedSet {
  setNumber: number;
  targetReps: number;
  targetWeight: number | null;
  restSeconds: number | null;
}

export interface NormalizedExercise {
  exerciseId: string;
  /** Nome risolto dal catalogo dal domain; usato dall'impl in memoria.
   *  L'impl Kysely lo re-deriva in lettura con una join. */
  exerciseName: string;
  position: number;
  notes: string | null;
  /** Recupero dopo questo esercizio, prima del successivo (secondi). */
  restSeconds: number | null;
  /** Vedi WorkoutExerciseInput.progressionIncrement in @gym-tracker/shared. */
  progressionIncrement: number | null;
  sets: NormalizedSet[];
}

export interface NormalizedWorkout {
  name: string;
  notes: string | null;
  exercises: NormalizedExercise[];
}

export interface WorkoutRepository {
  create(ownerId: string, input: NormalizedWorkout): Promise<WorkoutDetail>;
  listByOwner(ownerId: string): Promise<WorkoutSummary[]>;
  findDetail(ownerId: string, id: string): Promise<WorkoutDetail | null>;
  /** null se la scheda non esiste o non e' dell'utente. */
  replace(ownerId: string, id: string, input: NormalizedWorkout): Promise<WorkoutDetail | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
  /** Riassegna position = index+1 secondo orderedIds. Lancia NotFoundError se
   *  orderedIds non corrisponde esattamente all'insieme delle schede di ownerId. */
  reorder(ownerId: string, orderedIds: string[]): Promise<void>;
}

export class KyselyWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(ownerId: string, input: NormalizedWorkout): Promise<WorkoutDetail> {
    const id = await this.db.transaction().execute(async (trx) => {
      const nextPosition = await trx
        .selectFrom("workouts")
        .select((eb) => eb.fn.coalesce(eb.fn.max("position"), eb.lit(0)).as("max_position"))
        .where("owner_id", "=", ownerId)
        .executeTakeFirstOrThrow();
      const workout = await trx
        .insertInto("workouts")
        .values({
          owner_id: ownerId,
          name: input.name,
          notes: input.notes,
          position: Number(nextPosition.max_position) + 1,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await insertChildren(trx, workout.id, input.exercises);
      return workout.id;
    });
    // Appena creata: findDetail non puo' essere null.
    return (await this.findDetail(ownerId, id)) as WorkoutDetail;
  }

  async replace(
    ownerId: string,
    id: string,
    input: NormalizedWorkout
  ): Promise<WorkoutDetail | null> {
    const replaced = await this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom("workouts")
        .select("id")
        .where("id", "=", id)
        .where("owner_id", "=", ownerId)
        .executeTakeFirst();
      if (!existing) {
        return false;
      }
      await trx
        .updateTable("workouts")
        .set({ name: input.name, notes: input.notes, updated_at: new Date() })
        .where("id", "=", id)
        .execute();
      // La cascade su workout_exercises elimina anche i relativi set.
      await trx.deleteFrom("workout_exercises").where("workout_id", "=", id).execute();
      await insertChildren(trx, id, input.exercises);
      return true;
    });
    return replaced ? this.findDetail(ownerId, id) : null;
  }

  async listByOwner(ownerId: string): Promise<WorkoutSummary[]> {
    const rows = await this.db
      .selectFrom("workouts as w")
      .leftJoin("workout_exercises as we", "we.workout_id", "w.id")
      .select(["w.id", "w.name", "w.notes", "w.created_at", "w.updated_at"])
      .select((eb) => eb.fn.count("we.id").as("exercise_count"))
      .where("w.owner_id", "=", ownerId)
      .groupBy("w.id")
      .orderBy("w.position", "asc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      exerciseCount: Number(r.exercise_count),
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async findDetail(ownerId: string, id: string): Promise<WorkoutDetail | null> {
    const workout = await this.db
      .selectFrom("workouts")
      .selectAll()
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .executeTakeFirst();
    if (!workout) {
      return null;
    }

    const exerciseRows = await this.db
      .selectFrom("workout_exercises as we")
      .innerJoin("exercises as e", "e.id", "we.exercise_id")
      .select([
        "we.id as id",
        "we.exercise_id as exercise_id",
        "we.position as position",
        "we.notes as notes",
        "we.rest_seconds as rest_seconds",
        "we.progression_increment as progression_increment",
        "e.name as exercise_name",
      ])
      .where("we.workout_id", "=", id)
      .orderBy("we.position")
      .execute();

    const weIds = exerciseRows.map((r) => r.id);
    const setRows =
      weIds.length > 0
        ? await this.db
            .selectFrom("workout_sets")
            .selectAll()
            .where("workout_exercise_id", "in", weIds)
            .orderBy("set_number")
            .execute()
        : [];

    const setsByExercise = new Map<string, WorkoutSet[]>();
    for (const s of setRows) {
      const list = setsByExercise.get(s.workout_exercise_id) ?? [];
      list.push({
        id: s.id,
        setNumber: s.set_number,
        targetReps: s.target_reps,
        targetWeight: s.target_weight === null ? null : Number(s.target_weight),
        restSeconds: s.rest_seconds,
      });
      setsByExercise.set(s.workout_exercise_id, list);
    }

    return {
      id: workout.id,
      name: workout.name,
      notes: workout.notes,
      exercises: exerciseRows.map((r) => ({
        id: r.id,
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
        position: r.position,
        notes: r.notes,
        restSeconds: r.rest_seconds,
        progressionIncrement:
          r.progression_increment === null ? null : Number(r.progression_increment),
        sets: setsByExercise.get(r.id) ?? [],
      })),
      createdAt: workout.created_at.toISOString(),
      updatedAt: workout.updated_at.toISOString(),
    };
  }

  async delete(ownerId: string, id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("workouts")
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .execute();
    return (result[0]?.numDeletedRows ?? 0n) > 0n;
  }

  async reorder(ownerId: string, orderedIds: string[]): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const owned = await trx
        .selectFrom("workouts")
        .select("id")
        .where("owner_id", "=", ownerId)
        .execute();
      assertSameIdSet(
        owned.map((r) => r.id),
        orderedIds
      );

      for (const [index, id] of orderedIds.entries()) {
        await trx
          .updateTable("workouts")
          .set({ position: index + 1 })
          .where("id", "=", id)
          .where("owner_id", "=", ownerId)
          .execute();
      }
    });
  }
}

/** Lancia NotFoundError se orderedIds non e' esattamente l'insieme di ownedIds
 *  (stessa cardinalita', stessi elementi): usato da reorder per rifiutare sia
 *  id di un altro utente sia una lista incompleta rispetto alle schede reali. */
function assertSameIdSet(ownedIds: string[], orderedIds: string[]): void {
  const owned = new Set(ownedIds);
  const ordered = new Set(orderedIds);
  const sameSize = owned.size === ordered.size && ordered.size === orderedIds.length;
  const sameMembers = sameSize && [...owned].every((id) => ordered.has(id));
  if (!sameSize || !sameMembers) {
    throw new NotFoundError("Una o piu' schede non esistono o non sono dell'utente.");
  }
}

/** Inserisce esercizi e set di una scheda (dentro una transazione). */
async function insertChildren(
  trx: Kysely<Database>,
  workoutId: string,
  exercises: NormalizedExercise[]
): Promise<void> {
  for (const ex of exercises) {
    const we = await trx
      .insertInto("workout_exercises")
      .values({
        workout_id: workoutId,
        exercise_id: ex.exerciseId,
        position: ex.position,
        notes: ex.notes,
        rest_seconds: ex.restSeconds,
        progression_increment: ex.progressionIncrement,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    for (const s of ex.sets) {
      await trx
        .insertInto("workout_sets")
        .values({
          workout_exercise_id: we.id,
          set_number: s.setNumber,
          target_reps: s.targetReps,
          target_weight: s.targetWeight,
          rest_seconds: s.restSeconds,
        })
        .execute();
    }
  }
}

// --- Implementazione in memoria per i test ---

interface StoredWorkout {
  id: string;
  ownerId: string;
  name: string;
  notes: string | null;
  position: number;
  exercises: WorkoutExercise[];
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryWorkoutRepository implements WorkoutRepository {
  private readonly byId = new Map<string, StoredWorkout>();

  async create(ownerId: string, input: NormalizedWorkout): Promise<WorkoutDetail> {
    const now = new Date();
    const maxPosition = [...this.byId.values()]
      .filter((w) => w.ownerId === ownerId)
      .reduce((max, w) => Math.max(max, w.position), 0);
    const stored: StoredWorkout = {
      id: randomUUID(),
      ownerId,
      name: input.name,
      notes: input.notes,
      position: maxPosition + 1,
      exercises: buildExercises(input.exercises),
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(stored.id, stored);
    return toDetail(stored);
  }

  async replace(
    ownerId: string,
    id: string,
    input: NormalizedWorkout
  ): Promise<WorkoutDetail | null> {
    const existing = this.byId.get(id);
    if (!existing || existing.ownerId !== ownerId) {
      return null;
    }
    const updated: StoredWorkout = {
      ...existing,
      name: input.name,
      notes: input.notes,
      exercises: buildExercises(input.exercises),
      updatedAt: new Date(),
    };
    this.byId.set(id, updated);
    return toDetail(updated);
  }

  async listByOwner(ownerId: string): Promise<WorkoutSummary[]> {
    return [...this.byId.values()]
      .filter((w) => w.ownerId === ownerId)
      .sort((a, b) => a.position - b.position)
      .map((w) => ({
        id: w.id,
        name: w.name,
        notes: w.notes,
        exerciseCount: w.exercises.length,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      }));
  }

  async findDetail(ownerId: string, id: string): Promise<WorkoutDetail | null> {
    const stored = this.byId.get(id);
    if (!stored || stored.ownerId !== ownerId) {
      return null;
    }
    return toDetail(stored);
  }

  async delete(ownerId: string, id: string): Promise<boolean> {
    const stored = this.byId.get(id);
    if (!stored || stored.ownerId !== ownerId) {
      return false;
    }
    this.byId.delete(id);
    return true;
  }

  async reorder(ownerId: string, orderedIds: string[]): Promise<void> {
    const ownedIds = [...this.byId.values()].filter((w) => w.ownerId === ownerId).map((w) => w.id);
    assertSameIdSet(ownedIds, orderedIds);

    orderedIds.forEach((id, index) => {
      const stored = this.byId.get(id);
      if (stored) {
        this.byId.set(id, { ...stored, position: index + 1 });
      }
    });
  }
}

/** Assegna gli id (stabili) a esercizi e set alla scrittura. */
function buildExercises(exercises: NormalizedExercise[]): WorkoutExercise[] {
  return exercises.map((ex) => ({
    id: randomUUID(),
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName,
    position: ex.position,
    notes: ex.notes,
    restSeconds: ex.restSeconds,
    progressionIncrement: ex.progressionIncrement,
    sets: ex.sets.map((s) => ({
      id: randomUUID(),
      setNumber: s.setNumber,
      targetReps: s.targetReps,
      targetWeight: s.targetWeight,
      restSeconds: s.restSeconds,
    })),
  }));
}

function toDetail(w: StoredWorkout): WorkoutDetail {
  return {
    id: w.id,
    name: w.name,
    notes: w.notes,
    exercises: w.exercises,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

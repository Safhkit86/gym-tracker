import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type {
  SessionDetail,
  SessionExercise,
  SessionSet,
  SessionSummary,
} from "@gym-tracker/shared";
import type { Database } from "../db/types.js";

// --- Input normalizzato dal domain (owner gia' noto, nessuna validazione DB) ---

export interface NormalizedSessionSet {
  setNumber: number;
  targetReps: number | null;
  actualReps: number;
  actualWeight: number | null;
  actualRpe: number | null;
}

export interface NormalizedSessionExercise {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string | null;
  progressionIncrement: number | null;
  sets: NormalizedSessionSet[];
}

export interface NormalizedSession {
  workoutId: string;
  workoutName: string;
  performedAt: string;
  notes: string | null;
  exercises: NormalizedSessionExercise[];
}

/** Un set eseguito, per il motore di regole (senza il nome esercizio: gia' noto al chiamante). */
export interface HistoricalSet {
  setNumber: number;
  targetReps: number | null;
  actualReps: number;
  actualWeight: number | null;
}

/** Una sessione storica per un esercizio, ordinata dalla piu' recente. */
export interface ExerciseSessionSnapshot {
  sessionId: string;
  performedAt: string;
  sets: HistoricalSet[];
}

export interface SessionRepository {
  create(ownerId: string, input: NormalizedSession): Promise<SessionDetail>;
  listByOwner(ownerId: string): Promise<SessionSummary[]>;
  findDetail(ownerId: string, id: string): Promise<SessionDetail | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
  /**
   * Ultime `limit` sessioni (piu' recente prima) per lo stesso
   * (owner, scheda, esercizio) — include la sessione appena creata.
   * Lo scope e' per-scheda: lo stesso esercizio in una scheda diversa non
   * fa parte dello stesso "programma" (vedi progression-rule-engine.ts).
   */
  findRecentSetsForExercise(
    ownerId: string,
    workoutId: string,
    exerciseId: string,
    limit: number
  ): Promise<ExerciseSessionSnapshot[]>;
}

export class KyselySessionRepository implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(ownerId: string, input: NormalizedSession): Promise<SessionDetail> {
    const id = await this.db.transaction().execute(async (trx) => {
      const session = await trx
        .insertInto("workout_sessions")
        .values({
          owner_id: ownerId,
          workout_id: input.workoutId,
          workout_name: input.workoutName,
          performed_at: input.performedAt,
          notes: input.notes,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      for (const ex of input.exercises) {
        for (const s of ex.sets) {
          await trx
            .insertInto("session_sets")
            .values({
              session_id: session.id,
              exercise_id: ex.exerciseId,
              exercise_name: ex.exerciseName,
              workout_exercise_id: ex.workoutExerciseId,
              set_number: s.setNumber,
              target_reps: s.targetReps,
              progression_increment: ex.progressionIncrement,
              actual_reps: s.actualReps,
              actual_weight: s.actualWeight,
              actual_rpe: s.actualRpe,
            })
            .execute();
        }
      }
      return session.id;
    });
    // Appena creata: findDetail non puo' essere null.
    return (await this.findDetail(ownerId, id)) as SessionDetail;
  }

  async listByOwner(ownerId: string): Promise<SessionSummary[]> {
    const rows = await this.db
      .selectFrom("workout_sessions as ws")
      .leftJoin("session_sets as ss", "ss.session_id", "ws.id")
      .select(["ws.id", "ws.workout_id", "ws.workout_name", "ws.performed_at", "ws.created_at"])
      .select((eb) => eb.fn.count("ss.exercise_id").distinct().as("exercise_count"))
      .where("ws.owner_id", "=", ownerId)
      .groupBy("ws.id")
      .orderBy("ws.performed_at", "desc")
      .orderBy("ws.created_at", "desc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      workoutId: r.workout_id,
      workoutName: r.workout_name,
      performedAt: r.performed_at.toISOString(),
      exerciseCount: Number(r.exercise_count),
      createdAt: r.created_at.toISOString(),
    }));
  }

  async findDetail(ownerId: string, id: string): Promise<SessionDetail | null> {
    const session = await this.db
      .selectFrom("workout_sessions")
      .selectAll()
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .executeTakeFirst();
    if (!session) {
      return null;
    }

    const setRows = await this.db
      .selectFrom("session_sets")
      .selectAll()
      .where("session_id", "=", id)
      .orderBy("created_at")
      .orderBy("set_number")
      .execute();

    const exercisesByExerciseId = new Map<string, SessionExercise>();
    for (const s of setRows) {
      let exercise = exercisesByExerciseId.get(s.exercise_id);
      if (!exercise) {
        exercise = {
          exerciseId: s.exercise_id,
          exerciseName: s.exercise_name,
          workoutExerciseId: s.workout_exercise_id,
          progressionIncrement:
            s.progression_increment === null ? null : Number(s.progression_increment),
          sets: [],
        };
        exercisesByExerciseId.set(s.exercise_id, exercise);
      }
      const set: SessionSet = {
        id: s.id,
        setNumber: s.set_number,
        targetReps: s.target_reps,
        actualReps: s.actual_reps,
        actualWeight: s.actual_weight === null ? null : Number(s.actual_weight),
        actualRpe: s.actual_rpe,
      };
      exercise.sets.push(set);
    }

    return {
      id: session.id,
      workoutId: session.workout_id,
      workoutName: session.workout_name,
      performedAt: session.performed_at.toISOString(),
      notes: session.notes,
      exercises: [...exercisesByExerciseId.values()],
      createdAt: session.created_at.toISOString(),
    };
  }

  async delete(ownerId: string, id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("workout_sessions")
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .execute();
    return (result[0]?.numDeletedRows ?? 0n) > 0n;
  }

  async findRecentSetsForExercise(
    ownerId: string,
    workoutId: string,
    exerciseId: string,
    limit: number
  ): Promise<ExerciseSessionSnapshot[]> {
    const sessions = await this.db
      .selectFrom("workout_sessions as ws")
      .select(["ws.id", "ws.performed_at", "ws.created_at"])
      .where("ws.owner_id", "=", ownerId)
      .where("ws.workout_id", "=", workoutId)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("session_sets as ss")
            .select("ss.id")
            .whereRef("ss.session_id", "=", "ws.id")
            .where("ss.exercise_id", "=", exerciseId)
        )
      )
      .orderBy("ws.performed_at", "desc")
      .orderBy("ws.created_at", "desc")
      .limit(limit)
      .execute();

    if (sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((s) => s.id);
    const setRows = await this.db
      .selectFrom("session_sets")
      .select(["session_id", "set_number", "target_reps", "actual_reps", "actual_weight"])
      .where("session_id", "in", sessionIds)
      .where("exercise_id", "=", exerciseId)
      .orderBy("set_number")
      .execute();

    const setsBySession = new Map<string, HistoricalSet[]>();
    for (const s of setRows) {
      const list = setsBySession.get(s.session_id) ?? [];
      list.push({
        setNumber: s.set_number,
        targetReps: s.target_reps,
        actualReps: s.actual_reps,
        actualWeight: s.actual_weight === null ? null : Number(s.actual_weight),
      });
      setsBySession.set(s.session_id, list);
    }

    return sessions.map((s) => ({
      sessionId: s.id,
      performedAt: s.performed_at.toISOString(),
      sets: setsBySession.get(s.id) ?? [],
    }));
  }
}

// --- Implementazione in memoria per i test ---

interface StoredSession {
  id: string;
  ownerId: string;
  workoutId: string;
  workoutName: string;
  performedAt: string;
  notes: string | null;
  exercises: SessionExercise[];
  createdAt: Date;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<string, StoredSession>();

  async create(ownerId: string, input: NormalizedSession): Promise<SessionDetail> {
    const stored: StoredSession = {
      id: randomUUID(),
      ownerId,
      workoutId: input.workoutId,
      workoutName: input.workoutName,
      performedAt: input.performedAt,
      notes: input.notes,
      exercises: input.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        workoutExerciseId: ex.workoutExerciseId,
        progressionIncrement: ex.progressionIncrement,
        sets: ex.sets.map((s) => ({
          id: randomUUID(),
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          actualReps: s.actualReps,
          actualWeight: s.actualWeight,
          actualRpe: s.actualRpe,
        })),
      })),
      createdAt: new Date(),
    };
    this.byId.set(stored.id, stored);
    return toDetail(stored);
  }

  async listByOwner(ownerId: string): Promise<SessionSummary[]> {
    return [...this.byId.values()]
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => {
        const byPerformed = b.performedAt.localeCompare(a.performedAt);
        return byPerformed !== 0 ? byPerformed : b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map((s) => ({
        id: s.id,
        workoutId: s.workoutId,
        workoutName: s.workoutName,
        performedAt: s.performedAt,
        exerciseCount: s.exercises.length,
        createdAt: s.createdAt.toISOString(),
      }));
  }

  async findDetail(ownerId: string, id: string): Promise<SessionDetail | null> {
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

  async findRecentSetsForExercise(
    ownerId: string,
    workoutId: string,
    exerciseId: string,
    limit: number
  ): Promise<ExerciseSessionSnapshot[]> {
    return [...this.byId.values()]
      .filter((s) => s.ownerId === ownerId && s.workoutId === workoutId)
      .filter((s) => s.exercises.some((ex) => ex.exerciseId === exerciseId))
      .sort((a, b) => {
        const byPerformed = b.performedAt.localeCompare(a.performedAt);
        return byPerformed !== 0 ? byPerformed : b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limit)
      .map((s) => {
        const exercise = s.exercises.find((ex) => ex.exerciseId === exerciseId);
        return {
          sessionId: s.id,
          performedAt: s.performedAt,
          sets: (exercise?.sets ?? []).map((set) => ({
            setNumber: set.setNumber,
            targetReps: set.targetReps,
            actualReps: set.actualReps,
            actualWeight: set.actualWeight,
          })),
        };
      });
  }
}

function toDetail(s: StoredSession): SessionDetail {
  return {
    id: s.id,
    workoutId: s.workoutId,
    workoutName: s.workoutName,
    performedAt: s.performedAt,
    notes: s.notes,
    exercises: s.exercises,
    createdAt: s.createdAt.toISOString(),
  };
}

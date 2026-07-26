import { type Kysely, sql } from "kysely";
import type { DashboardStats, MuscleGroupVolumeEntry, StalledExercise } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";
import type { SessionRepository } from "./session-repository.js";
import type { ProgressionEventRepository } from "./progression-event-repository.js";

/** Sotto questa soglia (giorni dall'ultima progressione, o dal primo log se
 *  non ne ha mai avuta una) un esercizio non viene segnalato come "in
 *  stallo": evita di marcare come tale un esercizio fatto pochi giorni fa. */
const STALLED_THRESHOLD_DAYS = 21;
/** Finestra per "esercizi recenti" (candidati per i grafici della Dashboard)
 *  e per il calendario di costanza: stessa ampiezza di entrambi i widget. */
const RECENT_WINDOW_DAYS = 35;
const MAX_RECENT_EXERCISES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface StatsRepository {
  getStats(ownerId: string, now?: Date): Promise<DashboardStats>;
  getStalledExercise(ownerId: string, now?: Date): Promise<StalledExercise | null>;
}

export class KyselyStatsRepository implements StatsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async getStats(ownerId: string, now: Date = new Date()): Promise<DashboardStats> {
    const weekStart = startOfWeekUtc(now);
    const weekEnd = addDays(weekStart, 7);
    const recentFrom = addDays(now, -RECENT_WINDOW_DAYS);

    const [sessionCountRow, weekRows, kgRow, volumeRows, recentRows, calendarRows] =
      await Promise.all([
        this.db
          .selectFrom("workout_sessions")
          .select((eb) => eb.fn.countAll<string>().as("count"))
          .where("owner_id", "=", ownerId)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("workout_sessions")
          .select(sql<Date>`date_trunc('week', performed_at)`.as("week_start"))
          .distinct()
          .where("owner_id", "=", ownerId)
          .execute(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(sql<string>`coalesce(sum(ss.actual_weight * ss.actual_reps), 0)`.as("total"))
          .where("ws.owner_id", "=", ownerId)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(["ss.exercise_id", "ss.exercise_name"])
          .select((eb) => eb.fn.countAll<string>().as("set_count"))
          .select((eb) => eb.fn.coalesce(eb.fn.sum("ss.actual_reps"), eb.lit(0)).as("rep_count"))
          .where("ws.owner_id", "=", ownerId)
          .where("ws.performed_at", ">=", weekStart)
          .where("ws.performed_at", "<", weekEnd)
          .groupBy(["ss.exercise_id", "ss.exercise_name"])
          .execute(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(["ss.exercise_id", "ss.exercise_name"])
          .select((eb) => eb.fn.max("ws.performed_at").as("last_performed"))
          .where("ws.owner_id", "=", ownerId)
          .where("ws.performed_at", ">=", recentFrom)
          .groupBy(["ss.exercise_id", "ss.exercise_name"])
          .orderBy("last_performed", "desc")
          .limit(MAX_RECENT_EXERCISES)
          .execute(),
        this.db
          .selectFrom("workout_sessions")
          .select(sql<Date>`date_trunc('day', performed_at)`.as("day"))
          .distinct()
          .where("owner_id", "=", ownerId)
          .where("performed_at", ">=", recentFrom)
          .execute(),
      ]);

    const weekSet = new Set(weekRows.map((r) => toDateOnly(new Date(r.week_start))));
    let cursor = startOfWeekUtc(now);
    if (!weekSet.has(toDateOnly(cursor))) {
      cursor = addDays(cursor, -7);
    }
    let consecutiveWeeks = 0;
    while (weekSet.has(toDateOnly(cursor))) {
      consecutiveWeeks++;
      cursor = addDays(cursor, -7);
    }

    const currentWeekVolumeByExercise: MuscleGroupVolumeEntry[] = volumeRows.map((r) => ({
      exerciseId: r.exercise_id,
      exerciseName: r.exercise_name,
      setCount: Number(r.set_count),
      repCount: Number(r.rep_count),
    }));

    return {
      sessionCount: Number(sessionCountRow.count),
      consecutiveWeeks,
      totalKgLifted: Number(kgRow.total),
      currentWeekVolumeByExercise,
      recentExercises: recentRows.map((r) => ({
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
      })),
      streakCalendar: calendarRows.map((r) => toDateOnly(new Date(r.day))).sort(),
    };
  }

  async getStalledExercise(
    ownerId: string,
    now: Date = new Date()
  ): Promise<StalledExercise | null> {
    const [firstLoggedRows, lastProgressionRows] = await Promise.all([
      this.db
        .selectFrom("session_sets as ss")
        .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
        .select(["ss.exercise_id", "ss.exercise_name"])
        .select((eb) => eb.fn.min("ws.performed_at").as("first_logged"))
        .where("ws.owner_id", "=", ownerId)
        .groupBy(["ss.exercise_id", "ss.exercise_name"])
        .execute(),
      this.db
        .selectFrom("progression_events")
        .select("exercise_id")
        .select((eb) => eb.fn.max("created_at").as("last_progression"))
        .where("owner_id", "=", ownerId)
        .groupBy("exercise_id")
        .execute(),
    ]);

    if (firstLoggedRows.length === 0) {
      return null;
    }

    const lastProgressionByExercise = new Map(
      lastProgressionRows.map((r) => [r.exercise_id, new Date(r.last_progression)])
    );

    let stalled: StalledExercise | null = null;
    let maxGapDays = -1;
    for (const row of firstLoggedRows) {
      const anchor = lastProgressionByExercise.get(row.exercise_id) ?? new Date(row.first_logged);
      const gapDays = Math.floor((now.getTime() - anchor.getTime()) / DAY_MS);
      if (gapDays > maxGapDays) {
        maxGapDays = gapDays;
        stalled = {
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          daysSinceLastProgression: gapDays,
        };
      }
    }

    return stalled && stalled.daysSinceLastProgression >= STALLED_THRESHOLD_DAYS ? stalled : null;
  }
}

// --- Implementazione in memoria per i test ---
//
// A differenza di KyselyStatsRepository (query SQL aggregate dirette sulle
// tabelle, per evitare di caricare in memoria lo storico completo — vedi
// nota su "Kg totali sollevati" nel piano), qui non ha senso duplicare uno
// storage: si compone sugli stessi repository in memoria di sessioni ed
// eventi di progressione gia' usati dal resto dell'app di test, e si
// ricalcola in JS. Le due implementazioni condividono solo l'interfaccia
// pubblica, non la strategia.
export class InMemoryStatsRepository implements StatsRepository {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly progressionEvents: ProgressionEventRepository
  ) {}

  async getStats(ownerId: string, now: Date = new Date()): Promise<DashboardStats> {
    const sessions = await this.sessions.listByOwner(ownerId);
    const weekStart = startOfWeekUtc(now);
    const weekEnd = addDays(weekStart, 7);
    const recentFrom = addDays(now, -RECENT_WINDOW_DAYS);

    const weekSet = new Set(
      sessions.map((s) => toDateOnly(startOfWeekUtc(new Date(s.performedAt))))
    );
    let cursor = startOfWeekUtc(now);
    if (!weekSet.has(toDateOnly(cursor))) {
      cursor = addDays(cursor, -7);
    }
    let consecutiveWeeks = 0;
    while (weekSet.has(toDateOnly(cursor))) {
      consecutiveWeeks++;
      cursor = addDays(cursor, -7);
    }

    let totalKgLifted = 0;
    const volumeByExercise = new Map<string, MuscleGroupVolumeEntry>();
    const lastPerformedByExercise = new Map<
      string,
      { exerciseName: string; lastPerformed: Date }
    >();
    const trainedDays = new Set<string>();

    for (const session of sessions) {
      const performedAt = new Date(session.performedAt);
      if (performedAt >= recentFrom) {
        trainedDays.add(toDateOnly(performedAt));
      }
      for (const exercise of session.exercises) {
        for (const set of exercise.sets) {
          totalKgLifted += (set.actualWeight ?? 0) * set.actualReps;
        }
        if (performedAt >= weekStart && performedAt < weekEnd) {
          const entry = volumeByExercise.get(exercise.exerciseId) ?? {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            setCount: 0,
            repCount: 0,
          };
          entry.setCount += exercise.sets.length;
          entry.repCount += exercise.sets.reduce((sum, s) => sum + s.actualReps, 0);
          volumeByExercise.set(exercise.exerciseId, entry);
        }
        if (performedAt >= recentFrom) {
          const existing = lastPerformedByExercise.get(exercise.exerciseId);
          if (!existing || performedAt > existing.lastPerformed) {
            lastPerformedByExercise.set(exercise.exerciseId, {
              exerciseName: exercise.exerciseName,
              lastPerformed: performedAt,
            });
          }
        }
      }
    }

    const recentExercises = [...lastPerformedByExercise.entries()]
      .sort((a, b) => b[1].lastPerformed.getTime() - a[1].lastPerformed.getTime())
      .slice(0, MAX_RECENT_EXERCISES)
      .map(([exerciseId, v]) => ({ exerciseId, exerciseName: v.exerciseName }));

    return {
      sessionCount: sessions.length,
      consecutiveWeeks,
      totalKgLifted,
      currentWeekVolumeByExercise: [...volumeByExercise.values()],
      recentExercises,
      streakCalendar: [...trainedDays].sort(),
    };
  }

  async getStalledExercise(
    ownerId: string,
    now: Date = new Date()
  ): Promise<StalledExercise | null> {
    const [sessions, events] = await Promise.all([
      this.sessions.listByOwner(ownerId),
      this.progressionEvents.listByOwner(ownerId),
    ]);
    if (sessions.length === 0) {
      return null;
    }

    const firstLoggedByExercise = new Map<string, { exerciseName: string; firstLogged: Date }>();
    for (const session of sessions) {
      const performedAt = new Date(session.performedAt);
      for (const exercise of session.exercises) {
        const existing = firstLoggedByExercise.get(exercise.exerciseId);
        if (!existing || performedAt < existing.firstLogged) {
          firstLoggedByExercise.set(exercise.exerciseId, {
            exerciseName: exercise.exerciseName,
            firstLogged: performedAt,
          });
        }
      }
    }

    const lastProgressionByExercise = new Map<string, Date>();
    for (const event of events) {
      const createdAt = new Date(event.createdAt);
      const existing = lastProgressionByExercise.get(event.exerciseId);
      if (!existing || createdAt > existing) {
        lastProgressionByExercise.set(event.exerciseId, createdAt);
      }
    }

    let stalled: StalledExercise | null = null;
    let maxGapDays = -1;
    for (const [exerciseId, info] of firstLoggedByExercise) {
      const anchor = lastProgressionByExercise.get(exerciseId) ?? info.firstLogged;
      const gapDays = Math.floor((now.getTime() - anchor.getTime()) / DAY_MS);
      if (gapDays > maxGapDays) {
        maxGapDays = gapDays;
        stalled = {
          exerciseId,
          exerciseName: info.exerciseName,
          daysSinceLastProgression: gapDays,
        };
      }
    }

    return stalled && stalled.daysSinceLastProgression >= STALLED_THRESHOLD_DAYS ? stalled : null;
  }
}

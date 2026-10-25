import { type Kysely, sql } from "kysely";
import type {
  DailyActivityEntry,
  DashboardStats,
  MuscleGroupVolumeEntry,
} from "@gym-tracker/shared";
import type { Database } from "../db/types.js";
import type { SessionRepository } from "./session-repository.js";

/** Finestra per "esercizi recenti", i candidati per i grafici della
 *  Dashboard. */
const RECENT_WINDOW_DAYS = 35;
/** Finestra per la heatmap "Costanza" della Dashboard: 12 mesi scorrevoli
 *  (non l'anno calendario) — cosi' non si azzera a gennaio e non perde i
 *  mesi a cavallo di un cambio d'anno, stesso principio di RECENT_WINDOW_DAYS
 *  ma su scala più ampia. */
const YEARLY_WINDOW_DAYS = 365;
const MAX_RECENT_EXERCISES = 20;

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
  getStats(userId: string, now?: Date): Promise<DashboardStats>;
}

export class KyselyStatsRepository implements StatsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async getStats(userId: string, now: Date = new Date()): Promise<DashboardStats> {
    const weekStart = startOfWeekUtc(now);
    const weekEnd = addDays(weekStart, 7);
    const recentFrom = addDays(now, -RECENT_WINDOW_DAYS);
    const yearlyFrom = addDays(now, -YEARLY_WINDOW_DAYS);

    const [sessionCountRow, weekRows, kgRow, volumeRows, recentRows, dailyActivityRows] =
      await Promise.all([
        this.db
          .selectFrom("workout_sessions")
          .select((eb) => eb.fn.countAll<string>().as("count"))
          .where("user_id", "=", userId)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("workout_sessions")
          .select(sql<Date>`date_trunc('week', performed_at)`.as("week_start"))
          .distinct()
          .where("user_id", "=", userId)
          .execute(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(sql<string>`coalesce(sum(ss.actual_weight * ss.actual_reps), 0)`.as("total"))
          .where("ws.user_id", "=", userId)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(["ss.exercise_id", "ss.exercise_name"])
          .select((eb) => eb.fn.countAll<string>().as("set_count"))
          .select((eb) => eb.fn.coalesce(eb.fn.sum("ss.actual_reps"), eb.lit(0)).as("rep_count"))
          .where("ws.user_id", "=", userId)
          .where("ws.performed_at", ">=", weekStart)
          .where("ws.performed_at", "<", weekEnd)
          .groupBy(["ss.exercise_id", "ss.exercise_name"])
          .execute(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(["ss.exercise_id", "ss.exercise_name"])
          .select((eb) => eb.fn.max("ws.performed_at").as("last_performed"))
          .where("ws.user_id", "=", userId)
          .where("ws.performed_at", ">=", recentFrom)
          .groupBy(["ss.exercise_id", "ss.exercise_name"])
          .orderBy("last_performed", "desc")
          .limit(MAX_RECENT_EXERCISES)
          .execute(),
        this.db
          .selectFrom("session_sets as ss")
          .innerJoin("workout_sessions as ws", "ws.id", "ss.session_id")
          .select(sql<Date>`date_trunc('day', ws.performed_at)`.as("day"))
          .select((eb) => eb.fn.countAll<string>().as("set_count"))
          .where("ws.user_id", "=", userId)
          .where("ws.performed_at", ">=", yearlyFrom)
          .groupBy("day")
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
      dailyActivity: dailyActivityRows
        .map((r) => ({ date: toDateOnly(new Date(r.day)), setCount: Number(r.set_count) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}

// --- Implementazione in memoria per i test ---
//
// A differenza di KyselyStatsRepository (query SQL aggregate dirette sulle
// tabelle, per evitare di caricare in memoria lo storico completo), qui non
// ha senso duplicare uno storage: si compone sullo stesso repository in
// memoria delle sessioni gia' usato dal resto dell'app di test, e si
// ricalcola in JS. Le due implementazioni condividono solo l'interfaccia
// pubblica, non la strategia.
export class InMemoryStatsRepository implements StatsRepository {
  constructor(private readonly sessions: SessionRepository) {}

  async getStats(userId: string, now: Date = new Date()): Promise<DashboardStats> {
    const sessions = await this.sessions.listByOwner(userId);
    const weekStart = startOfWeekUtc(now);
    const weekEnd = addDays(weekStart, 7);
    const recentFrom = addDays(now, -RECENT_WINDOW_DAYS);
    const yearlyFrom = addDays(now, -YEARLY_WINDOW_DAYS);

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
    const setCountByDay = new Map<string, number>();

    for (const session of sessions) {
      const performedAt = new Date(session.performedAt);
      for (const exercise of session.exercises) {
        if (performedAt >= yearlyFrom && exercise.sets.length > 0) {
          const day = toDateOnly(performedAt);
          setCountByDay.set(day, (setCountByDay.get(day) ?? 0) + exercise.sets.length);
        }
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
      dailyActivity: [...setCountByDay.entries()]
        .map(([date, setCount]): DailyActivityEntry => ({ date, setCount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}

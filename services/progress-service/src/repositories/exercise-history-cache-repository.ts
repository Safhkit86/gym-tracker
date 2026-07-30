import type { Kysely } from "kysely";
import type { HistoricalSetPayload, StalledExercise } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";
import type { ProgressionEventRepository } from "./progression-event-repository.js";

/** Una sessione storica per un esercizio, ordinata dalla piu' recente:
 *  stessa forma richiesta dal motore di regole (progression-rule-engine.ts). */
export interface HistoricalSet {
  setNumber: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  actualReps: number;
  actualWeight: number | null;
}

export interface ExerciseSessionSnapshot {
  sessionId: string;
  performedAt: string;
  sets: HistoricalSet[];
}

/** Una entry della finestra scorrevole `recent_outcomes`: come
 *  ExerciseSessionSnapshot ma con `workoutId`, necessario per il filtro di
 *  scope workout/exercise (vedi findRecentEntries). */
export interface RecentOutcomeEntry {
  sessionId: string;
  performedAt: string;
  workoutId: string;
  sets: HistoricalSetPayload[];
}

/** Quante entry tenere al massimo per esercizio: piu' del max di
 *  requiredConsecutiveSessions (10, vedi preferences-routes.ts), con un
 *  margine per non dover mai ri-espandere la finestra. */
const RECENT_OUTCOMES_WINDOW = 15;

/** Sotto questa soglia (giorni dall'ultima progressione, o dal primo log se
 *  non ne ha mai avuta una) un esercizio non viene segnalato come "in
 *  stallo": evita di marcare come tale un esercizio fatto pochi giorni fa. */
const STALLED_THRESHOLD_DAYS = 21;
/** Un esercizio il cui log piu' recente e' oltre questa soglia non entra
 *  nemmeno in classifica per "in stallo": molto piu' larga della soglia di
 *  stallo, per non escludere esercizi legittimamente attivi ma a cadenza non
 *  settimanale — serve solo a escludere quelli davvero abbandonati (es. una
 *  scheda sostituita mesi fa), che altrimenti dominerebbero falsamente il
 *  gap massimo rispetto a esercizi ancora allenati. */
const ACTIVELY_TRAINED_WINDOW_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExerciseHistoryCacheRepository {
  /** Registra una sessione appena loggata per un esercizio: aggiorna
   *  `first_logged_at` (mai spostato in avanti, solo LEAST con l'esistente)
   *  e la finestra scorrevole, e torna la finestra aggiornata (piu' recente
   *  prima) per l'immediata valutazione del motore di regole, senza una
   *  seconda lettura. Idempotente rispetto allo stesso sessionId (una
   *  ridelivery RabbitMQ non lo duplica nella finestra) — anche se la vera
   *  garanzia di "una sola volta" e' `processed_sessions`, vedi consumer. */
  recordSessionLogged(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    entry: RecentOutcomeEntry
  ): Promise<RecentOutcomeEntry[]>;
  /** Rimuove l'eventuale entry con quel sessionId dalla finestra. Non
   *  ricalcola `first_logged_at` anche se la sessione cancellata era la
   *  prima mai loggata (semplificazione accettata: edge case raro, impatto
   *  basso su un'ancora che serve solo a rilevare stallo/abbandono). */
  recordSessionDeleted(userId: string, exerciseId: string, sessionId: string): Promise<void>;
  getStalledExercise(userId: string, now?: Date): Promise<StalledExercise | null>;
}

/** Filtra/limita la finestra scorrevole per l'input del motore di regole:
 *  stessa semantica di scope di SessionRepository.findRecentSetsForExercise
 *  quando le due tabelle vivevano in questo servizio, ora applicata in
 *  JS sulla finestra in cache invece che con una query. */
export function filterEntriesForEvaluation(
  entries: RecentOutcomeEntry[],
  workoutId: string,
  limit: number,
  scope: "workout" | "exercise"
): ExerciseSessionSnapshot[] {
  return entries.filter((e) => scope !== "workout" || e.workoutId === workoutId).slice(0, limit);
}

/** Implementazione su Postgres via Kysely. */
export class KyselyExerciseHistoryCacheRepository implements ExerciseHistoryCacheRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async recordSessionLogged(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    entry: RecentOutcomeEntry
  ): Promise<RecentOutcomeEntry[]> {
    const existing = await this.db
      .selectFrom("exercise_history_cache")
      .selectAll()
      .where("user_id", "=", userId)
      .where("exercise_id", "=", exerciseId)
      .executeTakeFirst();

    const existingEntries: RecentOutcomeEntry[] = existing
      ? (JSON.parse(existing.recent_outcomes) as RecentOutcomeEntry[])
      : [];
    const withoutDuplicate = existingEntries.filter((e) => e.sessionId !== entry.sessionId);
    const updatedEntries = [entry, ...withoutDuplicate]
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      .slice(0, RECENT_OUTCOMES_WINDOW);

    const firstLoggedAt =
      existing && new Date(existing.first_logged_at) < new Date(entry.performedAt)
        ? existing.first_logged_at
        : entry.performedAt;

    await this.db
      .insertInto("exercise_history_cache")
      .values({
        user_id: userId,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        first_logged_at: firstLoggedAt,
        recent_outcomes: JSON.stringify(updatedEntries),
      })
      .onConflict((oc) =>
        oc.columns(["user_id", "exercise_id"]).doUpdateSet({
          exercise_name: exerciseName,
          first_logged_at: firstLoggedAt,
          recent_outcomes: JSON.stringify(updatedEntries),
          updated_at: new Date(),
        })
      )
      .execute();

    return updatedEntries;
  }

  async recordSessionDeleted(userId: string, exerciseId: string, sessionId: string): Promise<void> {
    const existing = await this.db
      .selectFrom("exercise_history_cache")
      .selectAll()
      .where("user_id", "=", userId)
      .where("exercise_id", "=", exerciseId)
      .executeTakeFirst();
    if (!existing) {
      return;
    }
    const entries = (JSON.parse(existing.recent_outcomes) as RecentOutcomeEntry[]).filter(
      (e) => e.sessionId !== sessionId
    );
    await this.db
      .updateTable("exercise_history_cache")
      .set({ recent_outcomes: JSON.stringify(entries), updated_at: new Date() })
      .where("user_id", "=", userId)
      .where("exercise_id", "=", exerciseId)
      .execute();
  }

  async getStalledExercise(
    userId: string,
    now: Date = new Date()
  ): Promise<StalledExercise | null> {
    const [cacheRows, lastProgressionRows] = await Promise.all([
      this.db
        .selectFrom("exercise_history_cache")
        .selectAll()
        .where("user_id", "=", userId)
        .execute(),
      this.db
        .selectFrom("progression_events")
        .select("exercise_id")
        .select((eb) => eb.fn.max("created_at").as("last_progression"))
        .where("user_id", "=", userId)
        .groupBy("exercise_id")
        .execute(),
    ]);

    return computeStalledExercise(
      cacheRows.map((r) => ({
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
        firstLoggedAt: new Date(r.first_logged_at),
        entries: JSON.parse(r.recent_outcomes) as RecentOutcomeEntry[],
      })),
      lastProgressionRows.map((r) => ({
        exerciseId: r.exercise_id,
        lastProgression: new Date(r.last_progression),
      })),
      now
    );
  }
}

/** Estratta per essere testabile senza un motore SQL: usata sia dall'impl
 *  Kysely sia da quella in memoria, cosi' il calcolo (che e' la parte con
 *  logica vera, a differenza delle query) e' condiviso invece che duplicato
 *  e testato due volte in modo indipendente. */
function computeStalledExercise(
  cache: {
    exerciseId: string;
    exerciseName: string;
    firstLoggedAt: Date;
    entries: RecentOutcomeEntry[];
  }[],
  lastProgressions: { exerciseId: string; lastProgression: Date }[],
  now: Date
): StalledExercise | null {
  const lastProgressionByExercise = new Map(
    lastProgressions.map((r) => [r.exerciseId, r.lastProgression])
  );

  const activelyTrainedFrom = now.getTime() - ACTIVELY_TRAINED_WINDOW_DAYS * DAY_MS;

  let stalled: StalledExercise | null = null;
  let maxGapDays = -1;
  for (const row of cache) {
    const sorted = [...row.entries].sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    const mostRecentLog = sorted[0];
    if (!mostRecentLog || new Date(mostRecentLog.performedAt).getTime() < activelyTrainedFrom) {
      continue; // esercizio non piu' allenato attivamente: non e' "in stallo", e' abbandonato.
    }

    const anchor = lastProgressionByExercise.get(row.exerciseId) ?? row.firstLoggedAt;
    const gapDays = Math.floor((now.getTime() - anchor.getTime()) / DAY_MS);
    if (gapDays > maxGapDays) {
      maxGapDays = gapDays;
      stalled = {
        exerciseId: row.exerciseId,
        exerciseName: row.exerciseName,
        daysSinceLastProgression: gapDays,
      };
    }
  }

  return stalled && stalled.daysSinceLastProgression >= STALLED_THRESHOLD_DAYS ? stalled : null;
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryExerciseHistoryCacheRepository implements ExerciseHistoryCacheRepository {
  private readonly byKey = new Map<
    string,
    { exerciseName: string; firstLoggedAt: string; entries: RecentOutcomeEntry[] }
  >();

  constructor(private readonly progressionEvents?: ProgressionEventRepository) {}

  private key(userId: string, exerciseId: string): string {
    return `${userId}:${exerciseId}`;
  }

  async recordSessionLogged(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    entry: RecentOutcomeEntry
  ): Promise<RecentOutcomeEntry[]> {
    const key = this.key(userId, exerciseId);
    const existing = this.byKey.get(key);
    const withoutDuplicate = (existing?.entries ?? []).filter(
      (e) => e.sessionId !== entry.sessionId
    );
    const updatedEntries = [entry, ...withoutDuplicate]
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      .slice(0, RECENT_OUTCOMES_WINDOW);
    const firstLoggedAt =
      existing && existing.firstLoggedAt < entry.performedAt
        ? existing.firstLoggedAt
        : entry.performedAt;
    this.byKey.set(key, { exerciseName, firstLoggedAt, entries: updatedEntries });
    return updatedEntries;
  }

  async recordSessionDeleted(userId: string, exerciseId: string, sessionId: string): Promise<void> {
    const key = this.key(userId, exerciseId);
    const existing = this.byKey.get(key);
    if (!existing) {
      return;
    }
    existing.entries = existing.entries.filter((e) => e.sessionId !== sessionId);
  }

  async getStalledExercise(
    userId: string,
    now: Date = new Date()
  ): Promise<StalledExercise | null> {
    const cacheRows = [...this.byKey.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([key, value]) => ({
        exerciseId: key.slice(userId.length + 1),
        exerciseName: value.exerciseName,
        firstLoggedAt: new Date(value.firstLoggedAt),
        entries: value.entries,
      }));

    const events = this.progressionEvents ? await this.progressionEvents.listByOwner(userId) : [];
    const lastProgressionByExercise = new Map<string, Date>();
    for (const event of events) {
      const createdAt = new Date(event.createdAt);
      const existing = lastProgressionByExercise.get(event.exerciseId);
      if (!existing || createdAt > existing) {
        lastProgressionByExercise.set(event.exerciseId, createdAt);
      }
    }

    return computeStalledExercise(
      cacheRows,
      [...lastProgressionByExercise.entries()].map(([exerciseId, lastProgression]) => ({
        exerciseId,
        lastProgression,
      })),
      now
    );
  }
}

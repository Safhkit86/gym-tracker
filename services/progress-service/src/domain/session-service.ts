import type {
  CreateSessionResponse,
  ExerciseHistoryPoint,
  Logger,
  ProgressionEvent,
  SessionDetail,
  SessionInput,
} from "@gym-tracker/shared";
import { NotFoundError } from "../errors.js";
import type { ProgressionEventPublisher } from "../events/publisher.js";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";
import type { NormalizedSession, SessionRepository } from "../repositories/session-repository.js";
import type { ProgressionPreferencesRepository } from "../repositories/progression-preferences-repository.js";
import type { ProgressionDefaultsRepository } from "../repositories/progression-defaults-repository.js";
import { evaluateProgression } from "./progression-rule-engine.js";

/**
 * Logica delle sessioni. Nessuna validazione contro workout-service (il
 * client invia uno snapshot autosufficiente, vedi @gym-tracker/shared -- non
 * viene mai fatta una chiamata HTTP tra i due servizi): solo owner-scoping e
 * valutazione del motore di regole dopo un log riuscito.
 */
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly progressionEvents: ProgressionEventRepository,
    private readonly progressionPreferences: ProgressionPreferencesRepository,
    private readonly progressionDefaults: ProgressionDefaultsRepository,
    private readonly publisher: ProgressionEventPublisher,
    private readonly logger: Logger
  ) {}

  async logSession(userId: string, input: SessionInput): Promise<CreateSessionResponse> {
    const session = await this.sessions.create(userId, normalize(input));
    const preferences = await this.progressionPreferences.find(userId);

    const suggestions: ProgressionEvent[] = [];
    const seenExerciseIds = new Set<string>();
    for (const exercise of session.exercises) {
      if (seenExerciseIds.has(exercise.exerciseId)) {
        continue;
      }
      seenExerciseIds.add(exercise.exerciseId);

      // Un eventuale override "accetta progressione" pendente per questo
      // esercizio ha gia' fatto il suo lavoro precompilando questo log (vedi
      // LogSessionPage.tsx): da qui in poi il normale prefill (ultima
      // sessione registrata) riflette gia' il nuovo valore, quindi si
      // consuma subito, a prescindere dall'esito della valutazione sotto.
      await this.progressionDefaults.consume(userId, exercise.exerciseId);

      const history = await this.sessions.findRecentSetsForExercise(
        userId,
        session.workoutId,
        exercise.exerciseId,
        preferences.requiredConsecutiveSessions,
        preferences.groupingScope
      );
      const result = evaluateProgression(
        history,
        exercise.progressionIncrement,
        preferences.requiredConsecutiveSessions
      );
      if (!result) {
        continue;
      }

      const event = await this.progressionEvents.create({
        userId,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        triggeringSessionId: session.id,
        ...result,
      });
      suggestions.push(event);

      try {
        await this.publisher.publish({ ...event, userId });
      } catch (err) {
        // Best-effort: la sessione e' gia' salvata con successo, un
        // fallimento di publish non deve far fallire la richiesta.
        this.logger.error({ err }, "pubblicazione evento fallita");
      }
    }

    return { ...session, suggestions };
  }

  async list(userId: string, limit?: number): Promise<SessionDetail[]> {
    return this.sessions.listByOwner(userId, limit);
  }

  /** Storico per il grafico "Progressioni per esercizio" della Dashboard:
   *  peso massimo del set per sessione se l'esercizio prevede pesi,
   *  altrimenti ripetizioni massime. Ordinato dal piu' vecchio al piu'
   *  recente (pronto per l'asse X del grafico). */
  async getExerciseHistory(
    userId: string,
    exerciseId: string,
    limit = 10
  ): Promise<ExerciseHistoryPoint[]> {
    const snapshots = await this.sessions.findExerciseHistory(userId, exerciseId, limit);
    const isWeighted = snapshots.some((snapshot) =>
      snapshot.sets.some((set) => set.actualWeight !== null)
    );

    return snapshots
      .slice()
      .reverse()
      .map((snapshot) => ({
        sessionId: snapshot.sessionId,
        performedAt: snapshot.performedAt,
        unit: isWeighted ? ("kg" as const) : ("reps" as const),
        value: isWeighted
          ? Math.max(...snapshot.sets.map((set) => set.actualWeight ?? 0))
          : Math.max(...snapshot.sets.map((set) => set.actualReps)),
      }));
  }

  async get(userId: string, id: string): Promise<SessionDetail> {
    const detail = await this.sessions.findDetail(userId, id);
    if (!detail) {
      throw new NotFoundError("Sessione non trovata.");
    }
    return detail;
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.sessions.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError("Sessione non trovata.");
    }
  }
}

function normalize(input: SessionInput): NormalizedSession {
  return {
    workoutId: input.workoutId,
    workoutName: input.workoutName,
    workoutNotes: input.workoutNotes ?? null,
    performedAt: input.performedAt,
    notes: input.notes ?? null,
    exercises: input.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      workoutExerciseId: e.workoutExerciseId ?? null,
      progressionIncrement: e.progressionIncrement ?? null,
      restSeconds: e.restSeconds ?? null,
      sets: e.sets.map((s) => ({
        setNumber: s.setNumber,
        targetMinReps: s.targetMinReps ?? null,
        targetMaxReps: s.targetMaxReps ?? null,
        actualReps: s.actualReps,
        actualWeight: s.actualWeight ?? null,
        actualRpe: s.actualRpe ?? null,
        targetRestMinSeconds: s.targetRestMinSeconds ?? null,
        targetRestMaxSeconds: s.targetRestMaxSeconds ?? null,
        actualRestSeconds: s.actualRestSeconds ?? null,
      })),
    })),
  };
}

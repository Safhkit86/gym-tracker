import type {
  ExerciseHistoryPoint,
  Logger,
  SessionDetail,
  SessionInput,
} from "@gym-tracker/shared";
import { NotFoundError } from "../errors.js";
import type { SessionEventPublisher } from "../events/publisher.js";
import type { NormalizedSession, SessionRepository } from "../repositories/session-repository.js";

/**
 * Logica delle sessioni. Nessuna validazione contro workout-service (il
 * client invia uno snapshot autosufficiente, vedi @gym-tracker/shared -- non
 * viene mai fatta una chiamata HTTP tra i due servizi): solo owner-scoping.
 * Nessuna logica di progressione qui (vive in progress-service, che valuta
 * il motore di regole consumando `session-logged` in modo asincrono).
 */
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly publisher: SessionEventPublisher,
    private readonly logger: Logger
  ) {}

  async logSession(userId: string, input: SessionInput): Promise<SessionDetail> {
    const session = await this.sessions.create(userId, normalize(input));

    try {
      await this.publisher.publishSessionLogged({
        sessionId: session.id,
        userId,
        workoutId: session.workoutId,
        performedAt: session.performedAt,
        exercises: session.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          progressionIncrement: exercise.progressionIncrement,
          sets: exercise.sets.map((set) => ({
            setNumber: set.setNumber,
            targetMinReps: set.targetMinReps,
            targetMaxReps: set.targetMaxReps,
            actualReps: set.actualReps,
            actualWeight: set.actualWeight,
          })),
        })),
      });
    } catch (err) {
      // Best-effort: la sessione e' gia' salvata con successo, un
      // fallimento di publish non deve far fallire la richiesta.
      this.logger.error({ err }, "pubblicazione di session-logged fallita");
    }

    return session;
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
    // Serve PRIMA di cancellare: dopo, non sapremmo piu' quali esercizi
    // erano nella sessione (necessario a progress-service per ripulire
    // exercise_history_cache, vedi SessionDeletedEvent).
    const detail = await this.sessions.findDetail(userId, id);
    if (!detail) {
      throw new NotFoundError("Sessione non trovata.");
    }
    const deleted = await this.sessions.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError("Sessione non trovata.");
    }
    try {
      await this.publisher.publishSessionDeleted({
        sessionId: id,
        userId,
        exerciseIds: detail.exercises.map((exercise) => exercise.exerciseId),
      });
    } catch (err) {
      this.logger.error({ err }, "pubblicazione di session-deleted fallita");
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

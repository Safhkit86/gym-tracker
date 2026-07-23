import type {
  CreateSessionResponse,
  Logger,
  ProgressionEvent,
  SessionDetail,
  SessionInput,
} from "@gym-tracker/shared";
import { NotFoundError } from "../errors.js";
import type { ProgressionEventPublisher } from "../events/publisher.js";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";
import type { NormalizedSession, SessionRepository } from "../repositories/session-repository.js";
import { REQUIRED_CONSECUTIVE_SESSIONS, evaluateProgression } from "./progression-rule-engine.js";

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
    private readonly publisher: ProgressionEventPublisher,
    private readonly logger: Logger
  ) {}

  async logSession(ownerId: string, input: SessionInput): Promise<CreateSessionResponse> {
    const session = await this.sessions.create(ownerId, normalize(input));

    const suggestions: ProgressionEvent[] = [];
    const seenExerciseIds = new Set<string>();
    for (const exercise of session.exercises) {
      if (seenExerciseIds.has(exercise.exerciseId)) {
        continue;
      }
      seenExerciseIds.add(exercise.exerciseId);

      const history = await this.sessions.findRecentSetsForExercise(
        ownerId,
        session.workoutId,
        exercise.exerciseId,
        REQUIRED_CONSECUTIVE_SESSIONS
      );
      const result = evaluateProgression(history, exercise.progressionIncrement);
      if (!result) {
        continue;
      }

      const event = await this.progressionEvents.create({
        ownerId,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        triggeringSessionId: session.id,
        ...result,
      });
      suggestions.push(event);

      try {
        await this.publisher.publish({ ...event, ownerId });
      } catch (err) {
        // Best-effort: la sessione e' gia' salvata con successo, un
        // fallimento di publish non deve far fallire la richiesta.
        this.logger.error({ err }, "pubblicazione evento fallita");
      }
    }

    return { ...session, suggestions };
  }

  async list(ownerId: string): Promise<SessionDetail[]> {
    return this.sessions.listByOwner(ownerId);
  }

  async get(ownerId: string, id: string): Promise<SessionDetail> {
    const detail = await this.sessions.findDetail(ownerId, id);
    if (!detail) {
      throw new NotFoundError("Sessione non trovata.");
    }
    return detail;
  }

  async delete(ownerId: string, id: string): Promise<void> {
    const deleted = await this.sessions.delete(ownerId, id);
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
      })),
    })),
  };
}

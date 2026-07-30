import { z } from "zod";
import {
  startReliableConsumer,
  SESSION_LOGGED_QUEUE,
  SESSION_DELETED_QUEUE,
  type Logger,
  type ReliableConsumer,
  type SessionLoggedEvent,
  type SessionDeletedEvent,
} from "@gym-tracker/shared";
import { evaluateProgression } from "../domain/progression-rule-engine.js";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";
import type { ProgressionPreferencesRepository } from "../repositories/progression-preferences-repository.js";
import type { ProgressionDefaultsRepository } from "../repositories/progression-defaults-repository.js";
import type { ProcessedSessionsRepository } from "../repositories/processed-sessions-repository.js";
import {
  filterEntriesForEvaluation,
  type ExerciseHistoryCacheRepository,
} from "../repositories/exercise-history-cache-repository.js";
import type { ProgressionEventPublisher } from "./publisher.js";

const historicalSetSchema = z.object({
  setNumber: z.number(),
  targetMinReps: z.number().nullable(),
  targetMaxReps: z.number().nullable(),
  actualReps: z.number(),
  actualWeight: z.number().nullable(),
});

const sessionLoggedEventSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  workoutId: z.string().uuid(),
  performedAt: z.string(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid(),
      exerciseName: z.string().min(1),
      progressionIncrement: z.number().nullable(),
      sets: z.array(historicalSetSchema),
    })
  ),
});

const sessionDeletedEventSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  exerciseIds: z.array(z.string().uuid()),
});

export function parseSessionLoggedEvent(raw: Buffer): SessionLoggedEvent {
  return sessionLoggedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export function parseSessionDeletedEvent(raw: Buffer): SessionDeletedEvent {
  return sessionDeletedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface SessionEventsConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  progressionEvents: ProgressionEventRepository;
  progressionPreferences: ProgressionPreferencesRepository;
  progressionDefaults: ProgressionDefaultsRepository;
  exerciseHistoryCache: ExerciseHistoryCacheRepository;
  processedSessions: ProcessedSessionsRepository;
  publisher: ProgressionEventPublisher;
}

/**
 * Valuta il motore di regole per una sessione appena loggata (era la parte
 * finale di SessionService.logSession quando le due responsabilita' erano
 * nello stesso servizio, ora triggerata da un evento invece che da una
 * richiesta HTTP). Idempotente rispetto a `processed_sessions`: una
 * ridelivery RabbitMQ della stessa sessione viene ignorata senza rivalutare
 * (eviterebbe di ricreare `progression_events` duplicati e ripubblicare
 * notifiche duplicate).
 */
export async function handleSessionLogged(
  event: SessionLoggedEvent,
  deps: SessionEventsConsumerDeps
): Promise<void> {
  const alreadyProcessed = await deps.processedSessions.findStatus(event.sessionId);
  if (alreadyProcessed) {
    return;
  }

  const preferences = await deps.progressionPreferences.find(event.userId);
  let hadSuggestions = false;

  for (const exercise of event.exercises) {
    // Un eventuale override "accetta progressione" pendente per questo
    // esercizio ha gia' fatto il suo lavoro precompilando questo log (vedi
    // LogSessionPage.tsx): da qui in poi il normale prefill riflette gia' il
    // nuovo valore, quindi si consuma subito, a prescindere dall'esito della
    // valutazione sotto.
    await deps.progressionDefaults.consume(event.userId, exercise.exerciseId);

    const entries = await deps.exerciseHistoryCache.recordSessionLogged(
      event.userId,
      exercise.exerciseId,
      exercise.exerciseName,
      {
        sessionId: event.sessionId,
        performedAt: event.performedAt,
        workoutId: event.workoutId,
        sets: exercise.sets,
      }
    );

    const history = filterEntriesForEvaluation(
      entries,
      event.workoutId,
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
    hadSuggestions = true;

    const created = await deps.progressionEvents.create({
      userId: event.userId,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      triggeringSessionId: event.sessionId,
      ...result,
    });

    try {
      await deps.publisher.publish({ ...created, userId: event.userId });
    } catch (err) {
      // Best-effort: l'evento e' gia' salvato con successo, un fallimento di
      // publish non deve bloccare la valutazione degli altri esercizi.
      deps.logger.error({ err }, "pubblicazione di progression-events fallita");
    }
  }

  await deps.processedSessions.markProcessed(event.sessionId, event.userId, hadSuggestions);
}

export async function handleSessionDeleted(
  event: SessionDeletedEvent,
  deps: SessionEventsConsumerDeps
): Promise<void> {
  await deps.progressionEvents.deleteByTriggeringSession(event.sessionId);
  for (const exerciseId of event.exerciseIds) {
    await deps.exerciseHistoryCache.recordSessionDeleted(event.userId, exerciseId, event.sessionId);
  }
}

export interface SessionEventsConsumer {
  close(): Promise<void>;
}

export async function startSessionEventsConsumer(
  deps: SessionEventsConsumerDeps
): Promise<SessionEventsConsumer> {
  const consumers: ReliableConsumer[] = await Promise.all([
    startReliableConsumer({
      connectionUrl: deps.connectionUrl,
      queueName: SESSION_LOGGED_QUEUE,
      logger: deps.logger,
      parseMessage: parseSessionLoggedEvent,
      handle: (event) => handleSessionLogged(event, deps),
    }),
    startReliableConsumer({
      connectionUrl: deps.connectionUrl,
      queueName: SESSION_DELETED_QUEUE,
      logger: deps.logger,
      parseMessage: parseSessionDeletedEvent,
      handle: (event) => handleSessionDeleted(event, deps),
    }),
  ]);

  return {
    close: async () => {
      await Promise.all(consumers.map((c) => c.close()));
    },
  };
}

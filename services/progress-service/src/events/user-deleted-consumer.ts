import { z } from "zod";
import {
  startReliableConsumer,
  USER_DELETED_PROGRESS_QUEUE,
  type Logger,
  type ReliableConsumer,
  type UserDeletedEvent,
} from "@gym-tracker/shared";
import type { ProgressionEventRepository } from "../repositories/progression-event-repository.js";
import type { ProgressionPreferencesRepository } from "../repositories/progression-preferences-repository.js";
import type { ProgressionDefaultsRepository } from "../repositories/progression-defaults-repository.js";
import type { ExerciseHistoryCacheRepository } from "../repositories/exercise-history-cache-repository.js";
import type { ProcessedSessionsRepository } from "../repositories/processed-sessions-repository.js";

const userDeletedEventSchema = z.object({
  userId: z.string().uuid(),
});

export function parseUserDeletedEvent(raw: Buffer): UserDeletedEvent {
  return userDeletedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface UserDeletedConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  progressionEvents: ProgressionEventRepository;
  progressionPreferences: ProgressionPreferencesRepository;
  progressionDefaults: ProgressionDefaultsRepository;
  exerciseHistoryCache: ExerciseHistoryCacheRepository;
  processedSessions: ProcessedSessionsRepository;
}

/**
 * Pulisce la quota di dati di progress-service dopo che l'utente ha
 * cancellato il proprio account (diritto all'oblio, GDPR), vedi
 * AccountDeletionService/UserDeletedEvent in account-service. Le 5 tabelle
 * di questo servizio non hanno FK tra loro per user_id (vedi db/types.ts),
 * quindi l'ordine di cancellazione non ha importanza.
 */
export async function handleUserDeleted(
  event: UserDeletedEvent,
  deps: UserDeletedConsumerDeps
): Promise<void> {
  await Promise.all([
    deps.progressionEvents.deleteAllForUser(event.userId),
    deps.progressionPreferences.delete(event.userId),
    deps.progressionDefaults.deleteAllForUser(event.userId),
    deps.exerciseHistoryCache.deleteAllForUser(event.userId),
    deps.processedSessions.deleteAllForUser(event.userId),
  ]);
}

export interface UserDeletedConsumer {
  close(): Promise<void>;
}

export async function startUserDeletedConsumer(
  deps: UserDeletedConsumerDeps
): Promise<UserDeletedConsumer> {
  const consumer: ReliableConsumer = await startReliableConsumer({
    connectionUrl: deps.connectionUrl,
    queueName: USER_DELETED_PROGRESS_QUEUE,
    logger: deps.logger,
    parseMessage: parseUserDeletedEvent,
    handle: (event) => handleUserDeleted(event, deps),
  });

  return {
    close: () => consumer.close(),
  };
}

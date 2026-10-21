import { z } from "zod";
import {
  startReliableConsumer,
  USER_DELETED_HISTORY_QUEUE,
  type Logger,
  type ReliableConsumer,
  type UserDeletedEvent,
} from "@gym-tracker/shared";
import type { SessionRepository } from "../repositories/session-repository.js";
import type { MeasurementEntryRepository } from "../repositories/measurement-entry-repository.js";

const userDeletedEventSchema = z.object({
  userId: z.string().uuid(),
});

export function parseUserDeletedEvent(raw: Buffer): UserDeletedEvent {
  return userDeletedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface UserDeletedConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  sessions: SessionRepository;
  measurementEntries: MeasurementEntryRepository;
}

/**
 * Pulisce la quota di dati di history-service dopo che l'utente ha
 * cancellato il proprio account (diritto all'oblio, GDPR), vedi
 * AccountDeletionService/UserDeletedEvent in account-service. Non
 * pubblica session-deleted per ogni sessione cancellata: vedi commento su
 * SessionRepository.deleteAllForUser.
 */
export async function handleUserDeleted(
  event: UserDeletedEvent,
  deps: UserDeletedConsumerDeps
): Promise<void> {
  await deps.sessions.deleteAllForUser(event.userId);
  await deps.measurementEntries.deleteAllForUser(event.userId);
}

export interface UserDeletedConsumer {
  close(): Promise<void>;
}

export async function startUserDeletedConsumer(
  deps: UserDeletedConsumerDeps
): Promise<UserDeletedConsumer> {
  const consumer: ReliableConsumer = await startReliableConsumer({
    connectionUrl: deps.connectionUrl,
    queueName: USER_DELETED_HISTORY_QUEUE,
    logger: deps.logger,
    parseMessage: parseUserDeletedEvent,
    handle: (event) => handleUserDeleted(event, deps),
  });

  return {
    close: () => consumer.close(),
  };
}

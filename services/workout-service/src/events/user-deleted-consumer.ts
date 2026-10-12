import { z } from "zod";
import {
  startReliableConsumer,
  USER_DELETED_WORKOUT_QUEUE,
  type Logger,
  type ReliableConsumer,
  type UserDeletedEvent,
} from "@gym-tracker/shared";
import type { WorkoutRepository } from "../repositories/workout-repository.js";
import type { ExerciseRepository } from "../repositories/exercise-repository.js";

const userDeletedEventSchema = z.object({
  userId: z.string().uuid(),
});

export function parseUserDeletedEvent(raw: Buffer): UserDeletedEvent {
  return userDeletedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface UserDeletedConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  workouts: WorkoutRepository;
  exercises: ExerciseRepository;
}

/**
 * Pulisce la quota di dati di workout-service dopo che l'utente ha
 * cancellato il proprio account (diritto all'oblio, GDPR), vedi
 * AccountDeletionService/UserDeletedEvent in account-service. Le schede
 * vanno cancellate PRIMA degli esercizi custom: ExerciseRepository ha un
 * FK ON DELETE RESTRICT verso workout_exercises (vedi migrazione 001),
 * quindi un esercizio ancora referenziato da una scheda non cancellabile
 * dell'utente bloccherebbe la seconda query se l'ordine fosse invertito.
 */
export async function handleUserDeleted(
  event: UserDeletedEvent,
  deps: UserDeletedConsumerDeps
): Promise<void> {
  await deps.workouts.deleteAllForUser(event.userId);
  await deps.exercises.deleteAllCustomForUser(event.userId);
}

export interface UserDeletedConsumer {
  close(): Promise<void>;
}

export async function startUserDeletedConsumer(
  deps: UserDeletedConsumerDeps
): Promise<UserDeletedConsumer> {
  const consumer: ReliableConsumer = await startReliableConsumer({
    connectionUrl: deps.connectionUrl,
    queueName: USER_DELETED_WORKOUT_QUEUE,
    logger: deps.logger,
    parseMessage: parseUserDeletedEvent,
    handle: (event) => handleUserDeleted(event, deps),
  });

  return {
    close: () => consumer.close(),
  };
}

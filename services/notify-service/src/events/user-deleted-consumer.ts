import { z } from "zod";
import {
  startReliableConsumer,
  USER_DELETED_NOTIFY_QUEUE,
  type Logger,
  type Mailer,
  type ReliableConsumer,
  type UserDeletedEvent,
} from "@gym-tracker/shared";
import type { NotificationRepository } from "../repositories/notification-repository.js";

const userDeletedEventSchema = z.object({
  userId: z.string().uuid(),
});

export function parseUserDeletedEvent(raw: Buffer): UserDeletedEvent {
  return userDeletedEventSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface UserDeletedConsumerDeps {
  connectionUrl: string;
  logger: Logger;
  notifications: NotificationRepository;
  /** Opzionali: se presenti, un messaggio finito in dead-letter (retry
   *  esauriti o non processabile) avvisa questo indirizzo, stesso pattern
   *  gia' usato in index.ts per PROGRESSION_EVENTS_QUEUE. Omessi nei test
   *  (buildTestApp non ha un mailer/OPS_ALERT_EMAIL finti per questo). */
  mailer?: Mailer;
  opsAlertEmail?: string;
}

/**
 * Cancella le notifiche di questo utente dopo che ha cancellato il proprio
 * account (diritto all'oblio, GDPR), vedi AccountDeletionService/
 * UserDeletedEvent in account-service.
 */
export async function handleUserDeleted(
  event: UserDeletedEvent,
  deps: UserDeletedConsumerDeps
): Promise<void> {
  await deps.notifications.deleteAllForUser(event.userId);
}

export interface UserDeletedConsumer {
  close(): Promise<void>;
}

export async function startUserDeletedConsumer(
  deps: UserDeletedConsumerDeps
): Promise<UserDeletedConsumer> {
  const consumer: ReliableConsumer = await startReliableConsumer({
    connectionUrl: deps.connectionUrl,
    queueName: USER_DELETED_NOTIFY_QUEUE,
    logger: deps.logger,
    parseMessage: parseUserDeletedEvent,
    handle: (event) => handleUserDeleted(event, deps),
    onDeadLetter:
      deps.mailer && deps.opsAlertEmail
        ? async (raw, reason, error) => {
            await deps.mailer?.send({
              to: deps.opsAlertEmail as string,
              subject: `gym-tracker: messaggio in dead-letter (${USER_DELETED_NOTIFY_QUEUE})`,
              text: [
                `Coda: ${USER_DELETED_NOTIFY_QUEUE}`,
                `Motivo: ${reason === "poison" ? "messaggio non processabile" : "retry esauriti"}`,
                `Errore: ${String(error)}`,
                "",
                "Messaggio originale:",
                raw.toString("utf8"),
              ].join("\n"),
            });
          }
        : undefined,
  });

  return {
    close: () => consumer.close(),
  };
}

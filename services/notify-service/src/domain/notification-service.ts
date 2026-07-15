import type { Notification, ProgressionEventMessage } from "@gym-tracker/shared";
import { NotFoundError } from "../errors.js";
import type { NotificationRepository } from "../repositories/notification-repository.js";

/**
 * Logica delle notifiche. Nessuna validazione contro progress-service (il
 * messaggio dalla coda RabbitMQ e' gia' autosufficiente, vedi
 * @gym-tracker/shared): solo owner-scoping e trasformazione in `Notification`.
 */
export class NotificationService {
  constructor(private readonly notifications: NotificationRepository) {}

  async list(ownerId: string, unreadOnly = false): Promise<Notification[]> {
    return this.notifications.listByOwner(ownerId, { unreadOnly });
  }

  async markRead(ownerId: string, id: string): Promise<void> {
    const updated = await this.notifications.markRead(ownerId, id);
    if (!updated) {
      throw new NotFoundError("Notifica non trovata.");
    }
  }

  async markAllRead(ownerId: string): Promise<number> {
    return this.notifications.markAllRead(ownerId);
  }

  /** Chiamato dal consumer RabbitMQ per ogni messaggio valido. */
  async handleProgressionEvent(message: ProgressionEventMessage): Promise<void> {
    await this.notifications.create({
      ownerId: message.ownerId,
      exerciseId: message.exerciseId,
      exerciseName: message.exerciseName,
      suggestionType: message.suggestionType,
      previousValue: message.previousValue,
      suggestedValue: message.suggestedValue,
      reason: message.reason,
      triggeringSessionId: message.triggeringSessionId,
      progressionEventId: message.id,
    });
  }
}

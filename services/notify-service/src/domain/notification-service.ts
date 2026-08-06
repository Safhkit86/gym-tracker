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

  async list(userId: string, unreadOnly = false): Promise<Notification[]> {
    return this.notifications.listByOwner(userId, { unreadOnly });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const updated = await this.notifications.markRead(userId, id);
    if (!updated) {
      throw new NotFoundError("Notifica non trovata.");
    }
  }

  /** Chiamata da "Accetta progressione" (Dashboard/Notifiche), non da "Segna
   *  come letta": vedi il commento su acceptWithCascade nel repository per
   *  le regole di cascata verso i suggerimenti più vecchi dello stesso
   *  esercizio. */
  async accept(userId: string, id: string): Promise<void> {
    const updated = await this.notifications.acceptWithCascade(userId, id);
    if (!updated) {
      throw new NotFoundError("Notifica non trovata.");
    }
  }

  async markAllRead(userId: string): Promise<number> {
    return this.notifications.markAllRead(userId);
  }

  /** Chiamato dal consumer RabbitMQ per ogni messaggio valido. */
  async handleProgressionEvent(message: ProgressionEventMessage): Promise<void> {
    await this.notifications.create({
      userId: message.userId,
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

import type { Channel } from "amqplib";
import {
  USER_DELETED_HISTORY_QUEUE,
  USER_DELETED_NOTIFY_QUEUE,
  USER_DELETED_PROGRESS_QUEUE,
  USER_DELETED_WORKOUT_QUEUE,
  connectResilientAmqp,
  type Logger,
  type ResilientAmqpConnection,
  type UserDeletedEvent,
} from "@gym-tracker/shared";

const QUEUES = [
  USER_DELETED_WORKOUT_QUEUE,
  USER_DELETED_HISTORY_QUEUE,
  USER_DELETED_PROGRESS_QUEUE,
  USER_DELETED_NOTIFY_QUEUE,
] as const;

/**
 * Pubblica `UserDeletedEvent` su 4 code (vedi commento in
 * packages/shared/src/auth.ts). A differenza di
 * AmqpMeasurementEventPublisher, best-effort: la cancellazione primaria in
 * account-service (vedi AccountDeletionService) e' gia' avvenuta quando
 * questo publish parte, quindi un canale normale (non confirm) basta — un
 * fallimento qui non deve far fallire la richiesta HTTP di DELETE /me, solo
 * degradare la pulizia cross-service (loggato dal chiamante).
 */
export interface AccountDeletionEventPublisher {
  publishUserDeleted(event: UserDeletedEvent): Promise<void>;
  close?(): Promise<void>;
}

export class AmqpAccountDeletionEventPublisher implements AccountDeletionEventPublisher {
  private constructor(private readonly resilient: ResilientAmqpConnection<Channel>) {}

  static async connect(url: string, logger: Logger): Promise<AmqpAccountDeletionEventPublisher> {
    const resilient = await connectResilientAmqp<Channel>({
      url,
      logger,
      openChannel: (connection) => connection.createChannel(),
      setup: async (channel) => {
        for (const queue of QUEUES) {
          await channel.assertQueue(queue, { durable: true });
        }
      },
    });
    return new AmqpAccountDeletionEventPublisher(resilient);
  }

  async publishUserDeleted(event: UserDeletedEvent): Promise<void> {
    const channel = this.resilient.getChannel();
    if (!channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    const payload = Buffer.from(JSON.stringify(event));
    for (const queue of QUEUES) {
      channel.sendToQueue(queue, payload, { persistent: true });
    }
  }

  async close(): Promise<void> {
    await this.resilient.close();
  }
}

/** Per i test: nessun broker reale. */
export class InMemoryAccountDeletionEventPublisher implements AccountDeletionEventPublisher {
  readonly published: UserDeletedEvent[] = [];
  /** Simula un publish fallito, per testare che DELETE /me resti 200. */
  failNext = false;

  async publishUserDeleted(event: UserDeletedEvent): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("publish fallito (simulato)");
    }
    this.published.push(event);
  }
}

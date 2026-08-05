import type { Channel } from "amqplib";
import {
  PROGRESSION_EVENTS_QUEUE,
  connectResilientAmqp,
  type Logger,
  type ProgressionEventMessage,
  type ResilientAmqpConnection,
} from "@gym-tracker/shared";

/**
 * Pubblica un evento quando il motore di regole scatta. `notify-service`
 * (Fase 4) consumera' questi messaggi dalla coda `progression-events`.
 */
export interface ProgressionEventPublisher {
  publish(event: ProgressionEventMessage): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Publisher reale via RabbitMQ (amqplib). Coda durevole, messaggi
 * persistenti: sopravvivono a un riavvio del broker fino a quando
 * notify-service non li consuma. La pubblicazione e' best-effort rispetto a
 * Postgres (niente outbox pattern in v1): un fallimento qui non deve mai far
 * fallire il log di una sessione, gia' salvata con successo (vedi
 * session-service.ts). La connessione si riconnette da sola se cade dopo
 * l'avvio (vedi amqp-connection.ts).
 */
export class AmqpProgressionEventPublisher implements ProgressionEventPublisher {
  private constructor(private readonly resilient: ResilientAmqpConnection<Channel>) {}

  static async connect(url: string, logger: Logger): Promise<AmqpProgressionEventPublisher> {
    const resilient = await connectResilientAmqp<Channel>({
      url,
      logger,
      openChannel: (connection) => connection.createChannel(),
      setup: async (channel) => {
        await channel.assertQueue(PROGRESSION_EVENTS_QUEUE, { durable: true });
      },
    });
    return new AmqpProgressionEventPublisher(resilient);
  }

  async publish(event: ProgressionEventMessage): Promise<void> {
    const channel = this.resilient.getChannel();
    if (!channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    channel.sendToQueue(PROGRESSION_EVENTS_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async close(): Promise<void> {
    await this.resilient.close();
  }
}

/** Per i test: nessun broker reale (stesso motivo per cui i test non usano mai Postgres reale). */
export class InMemoryProgressionEventPublisher implements ProgressionEventPublisher {
  readonly published: ProgressionEventMessage[] = [];

  async publish(event: ProgressionEventMessage): Promise<void> {
    this.published.push(event);
  }
}

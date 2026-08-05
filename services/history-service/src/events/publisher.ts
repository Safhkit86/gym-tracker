import type { Channel } from "amqplib";
import {
  SESSION_LOGGED_QUEUE,
  SESSION_DELETED_QUEUE,
  connectResilientAmqp,
  type Logger,
  type SessionLoggedEvent,
  type SessionDeletedEvent,
  type ResilientAmqpConnection,
} from "@gym-tracker/shared";

/**
 * Pubblica gli eventi che progress-service consuma per aggiornare la propria
 * cache e valutare il motore di regole in modo asincrono (invece che nella
 * stessa richiesta HTTP, oggi che le due responsabilita' sono in servizi
 * diversi). `session-deleted` sostituisce l'FK reale che c'era quando
 * `progression_events` e `workout_sessions` vivevano nello stesso servizio.
 */
export interface SessionEventPublisher {
  publishSessionLogged(event: SessionLoggedEvent): Promise<void>;
  publishSessionDeleted(event: SessionDeletedEvent): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Publisher reale via RabbitMQ (amqplib). Code durevoli, messaggi
 * persistenti. La pubblicazione e' best-effort rispetto a Postgres (niente
 * outbox pattern): un fallimento qui non deve mai far fallire la richiesta
 * HTTP, la sessione e' gia' salvata/cancellata con successo (stesso pattern
 * gia' in uso per "progression-events" in progress-service). La connessione
 * si riconnette da sola se cade dopo l'avvio (vedi amqp-connection.ts).
 */
export class AmqpSessionEventPublisher implements SessionEventPublisher {
  private constructor(private readonly resilient: ResilientAmqpConnection<Channel>) {}

  /**
   * `depends_on: rabbitmq: condition: service_healthy` in docker-compose non
   * e' una garanzia assoluta (riavvii del broker, `npm run dev` sull'host
   * senza compose): riprova con backoff invece di andare subito in
   * crash-loop al primo avvio.
   */
  static async connect(url: string, logger: Logger): Promise<AmqpSessionEventPublisher> {
    const resilient = await connectResilientAmqp<Channel>({
      url,
      logger,
      openChannel: (connection) => connection.createChannel(),
      setup: async (channel) => {
        await channel.assertQueue(SESSION_LOGGED_QUEUE, { durable: true });
        await channel.assertQueue(SESSION_DELETED_QUEUE, { durable: true });
      },
    });
    return new AmqpSessionEventPublisher(resilient);
  }

  async publishSessionLogged(event: SessionLoggedEvent): Promise<void> {
    const channel = this.resilient.getChannel();
    if (!channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    channel.sendToQueue(SESSION_LOGGED_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async publishSessionDeleted(event: SessionDeletedEvent): Promise<void> {
    const channel = this.resilient.getChannel();
    if (!channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    channel.sendToQueue(SESSION_DELETED_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async close(): Promise<void> {
    await this.resilient.close();
  }
}

/** Per i test: nessun broker reale (stesso motivo per cui i test non usano mai Postgres reale). */
export class InMemorySessionEventPublisher implements SessionEventPublisher {
  readonly loggedEvents: SessionLoggedEvent[] = [];
  readonly deletedEvents: SessionDeletedEvent[] = [];

  async publishSessionLogged(event: SessionLoggedEvent): Promise<void> {
    this.loggedEvents.push(event);
  }

  async publishSessionDeleted(event: SessionDeletedEvent): Promise<void> {
    this.deletedEvents.push(event);
  }
}

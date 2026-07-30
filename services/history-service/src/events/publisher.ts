import amqplib, { type ChannelModel } from "amqplib";
import {
  SESSION_LOGGED_QUEUE,
  SESSION_DELETED_QUEUE,
  type Logger,
  type SessionLoggedEvent,
  type SessionDeletedEvent,
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

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Publisher reale via RabbitMQ (amqplib). Code durevoli, messaggi
 * persistenti. La pubblicazione e' best-effort rispetto a Postgres (niente
 * outbox pattern): un fallimento qui non deve mai far fallire la richiesta
 * HTTP, la sessione e' gia' salvata/cancellata con successo (stesso pattern
 * gia' in uso per "progression-events" in progress-service).
 */
export class AmqpSessionEventPublisher implements SessionEventPublisher {
  private connection: ChannelModel | null = null;
  private channel: Awaited<ReturnType<ChannelModel["createChannel"]>> | null = null;

  private constructor(
    connection: ChannelModel,
    channel: Awaited<ReturnType<ChannelModel["createChannel"]>>
  ) {
    this.connection = connection;
    this.channel = channel;
  }

  /**
   * `depends_on: rabbitmq: condition: service_healthy` in docker-compose non
   * e' una garanzia assoluta (riavvii del broker, `npm run dev` sull'host
   * senza compose): riprova con backoff invece di andare subito in
   * crash-loop al primo avvio.
   */
  static async connect(url: string, logger: Logger): Promise<AmqpSessionEventPublisher> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        const connection = await amqplib.connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue(SESSION_LOGGED_QUEUE, { durable: true });
        await channel.assertQueue(SESSION_DELETED_QUEUE, { durable: true });
        connection.on("error", (err) => {
          logger.error({ err }, "connessione RabbitMQ interrotta");
        });
        return new AmqpSessionEventPublisher(connection, channel);
      } catch (err) {
        lastError = err;
        if (attempt < MAX_CONNECT_ATTEMPTS) {
          await wait(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }
    throw new Error(
      `Impossibile connettersi a RabbitMQ dopo ${MAX_CONNECT_ATTEMPTS} tentativi: ${String(lastError)}`
    );
  }

  async publishSessionLogged(event: SessionLoggedEvent): Promise<void> {
    if (!this.channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    this.channel.sendToQueue(SESSION_LOGGED_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async publishSessionDeleted(event: SessionDeletedEvent): Promise<void> {
    if (!this.channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    this.channel.sendToQueue(SESSION_DELETED_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
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

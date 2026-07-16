import amqplib, { type ChannelModel } from "amqplib";
import { PROGRESSION_EVENTS_QUEUE, type Logger, type ProgressionEventMessage } from "@gym-tracker/shared";

/**
 * Pubblica un evento quando il motore di regole scatta. `notify-service`
 * (Fase 4) consumera' questi messaggi dalla coda `progression-events`.
 */
export interface ProgressionEventPublisher {
  publish(event: ProgressionEventMessage): Promise<void>;
  close?(): Promise<void>;
}

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Publisher reale via RabbitMQ (amqplib). Coda durevole, messaggi
 * persistenti: sopravvivono a un riavvio del broker fino a quando
 * notify-service non li consuma. La pubblicazione e' best-effort rispetto a
 * Postgres (niente outbox pattern in v1): un fallimento qui non deve mai far
 * fallire il log di una sessione, gia' salvata con successo (vedi
 * session-service.ts).
 */
export class AmqpProgressionEventPublisher implements ProgressionEventPublisher {
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
  static async connect(url: string, logger: Logger): Promise<AmqpProgressionEventPublisher> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        const connection = await amqplib.connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue(PROGRESSION_EVENTS_QUEUE, { durable: true });
        connection.on("error", (err) => {
          logger.error({ err }, "connessione RabbitMQ interrotta");
        });
        return new AmqpProgressionEventPublisher(connection, channel);
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

  async publish(event: ProgressionEventMessage): Promise<void> {
    if (!this.channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    this.channel.sendToQueue(PROGRESSION_EVENTS_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

/** Per i test: nessun broker reale (stesso motivo per cui i test non usano mai Postgres reale). */
export class InMemoryProgressionEventPublisher implements ProgressionEventPublisher {
  readonly published: ProgressionEventMessage[] = [];

  async publish(event: ProgressionEventMessage): Promise<void> {
    this.published.push(event);
  }
}

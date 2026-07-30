import amqplib, { type ChannelModel, type ConfirmChannel } from "amqplib";
import {
  MEASUREMENT_SAVE_REQUESTED_QUEUE,
  type Logger,
  type MeasurementSaveRequestedEvent,
} from "@gym-tracker/shared";

/**
 * Pubblica `measurement-save-requested`. A differenza di ogni altro
 * publisher del progetto (best-effort: la scrittura primaria e' gia'
 * avvenuta localmente), qui il publish E' l'unica scrittura primaria di
 * peso/petto/braccia/vita/gamba: account-service non ne tiene copia locale.
 * Serve quindi un canale "confirm" (ack a livello di broker, non solo di
 * TCP) e un fallimento deve propagare: la route (measurements-routes.ts)
 * fa fallire la richiesta HTTP, cosi' l'utente puo' riprovare invece di
 * credere il salvataggio riuscito quando non lo e' stato.
 */
export interface MeasurementEventPublisher {
  publishMeasurementSaveRequested(event: MeasurementSaveRequestedEvent): Promise<void>;
  close?(): Promise<void>;
}

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AmqpMeasurementEventPublisher implements MeasurementEventPublisher {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  private constructor(connection: ChannelModel, channel: ConfirmChannel) {
    this.connection = connection;
    this.channel = channel;
  }

  static async connect(url: string, logger: Logger): Promise<AmqpMeasurementEventPublisher> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        const connection = await amqplib.connect(url);
        const channel = await connection.createConfirmChannel();
        await channel.assertQueue(MEASUREMENT_SAVE_REQUESTED_QUEUE, { durable: true });
        connection.on("error", (err) => {
          logger.error({ err }, "connessione RabbitMQ interrotta");
        });
        return new AmqpMeasurementEventPublisher(connection, channel);
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

  async publishMeasurementSaveRequested(event: MeasurementSaveRequestedEvent): Promise<void> {
    if (!this.channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    const channel = this.channel;
    await new Promise<void>((resolve, reject) => {
      channel.sendToQueue(
        MEASUREMENT_SAVE_REQUESTED_QUEUE,
        Buffer.from(JSON.stringify(event)),
        { persistent: true },
        (err) => {
          if (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

/** Per i test: nessun broker reale. */
export class InMemoryMeasurementEventPublisher implements MeasurementEventPublisher {
  readonly published: MeasurementSaveRequestedEvent[] = [];
  /** Simula un publish confermato fallito, per testare il fail-fast dell'HTTP. */
  failNext = false;

  async publishMeasurementSaveRequested(event: MeasurementSaveRequestedEvent): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("publish non confermato (simulato)");
    }
    this.published.push(event);
  }
}

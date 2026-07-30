import amqplib, { type ChannelModel } from "amqplib";
import {
  MEASUREMENT_RECORDED_QUEUE,
  type Logger,
  type MeasurementRecordedEvent,
} from "@gym-tracker/shared";

/**
 * Pubblica `measurement-recorded` dopo l'upsert in `measurement_entries`,
 * consumato da account-service per aggiornare la propria cache Redis di
 * lettura veloce. Best-effort (a differenza di `measurement-save-requested`
 * in account-service): l'upsert e' gia' la scrittura primaria e va gia' a
 * buon fine prima del publish, un suo fallimento non deve invalidare
 * l'operazione — degrada solo a una cache non aggiornata finche' non arriva
 * un salvataggio successivo (vedi profile.ts, MeasurementRecordedEvent).
 */
export interface MeasurementEventPublisher {
  publishMeasurementRecorded(event: MeasurementRecordedEvent): Promise<void>;
  close?(): Promise<void>;
}

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AmqpMeasurementEventPublisher implements MeasurementEventPublisher {
  private connection: ChannelModel | null = null;
  private channel: Awaited<ReturnType<ChannelModel["createChannel"]>> | null = null;

  private constructor(
    connection: ChannelModel,
    channel: Awaited<ReturnType<ChannelModel["createChannel"]>>
  ) {
    this.connection = connection;
    this.channel = channel;
  }

  static async connect(url: string, logger: Logger): Promise<AmqpMeasurementEventPublisher> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        const connection = await amqplib.connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue(MEASUREMENT_RECORDED_QUEUE, { durable: true });
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

  async publishMeasurementRecorded(event: MeasurementRecordedEvent): Promise<void> {
    if (!this.channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    this.channel.sendToQueue(MEASUREMENT_RECORDED_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

/** Per i test: nessun broker reale. */
export class InMemoryMeasurementEventPublisher implements MeasurementEventPublisher {
  readonly published: MeasurementRecordedEvent[] = [];

  async publishMeasurementRecorded(event: MeasurementRecordedEvent): Promise<void> {
    this.published.push(event);
  }
}

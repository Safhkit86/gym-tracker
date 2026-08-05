import type { Channel } from "amqplib";
import {
  MEASUREMENT_RECORDED_QUEUE,
  connectResilientAmqp,
  type Logger,
  type MeasurementRecordedEvent,
  type ResilientAmqpConnection,
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

/** La connessione si riconnette da sola se cade dopo l'avvio (vedi
 *  amqp-connection.ts). */
export class AmqpMeasurementEventPublisher implements MeasurementEventPublisher {
  private constructor(private readonly resilient: ResilientAmqpConnection<Channel>) {}

  static async connect(url: string, logger: Logger): Promise<AmqpMeasurementEventPublisher> {
    const resilient = await connectResilientAmqp<Channel>({
      url,
      logger,
      openChannel: (connection) => connection.createChannel(),
      setup: async (channel) => {
        await channel.assertQueue(MEASUREMENT_RECORDED_QUEUE, { durable: true });
      },
    });
    return new AmqpMeasurementEventPublisher(resilient);
  }

  async publishMeasurementRecorded(event: MeasurementRecordedEvent): Promise<void> {
    const channel = this.resilient.getChannel();
    if (!channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
    channel.sendToQueue(MEASUREMENT_RECORDED_QUEUE, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }

  async close(): Promise<void> {
    await this.resilient.close();
  }
}

/** Per i test: nessun broker reale. */
export class InMemoryMeasurementEventPublisher implements MeasurementEventPublisher {
  readonly published: MeasurementRecordedEvent[] = [];

  async publishMeasurementRecorded(event: MeasurementRecordedEvent): Promise<void> {
    this.published.push(event);
  }
}

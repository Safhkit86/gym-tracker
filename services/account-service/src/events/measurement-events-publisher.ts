import type { ConfirmChannel } from "amqplib";
import {
  MEASUREMENT_SAVE_REQUESTED_QUEUE,
  connectResilientAmqp,
  type Logger,
  type MeasurementSaveRequestedEvent,
  type ResilientAmqpConnection,
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

/** La connessione si riconnette da sola se cade dopo l'avvio (vedi
 *  amqp-connection.ts) — durante la finestra di riconnessione,
 *  `publishMeasurementSaveRequested` fallisce (nessun canale disponibile),
 *  propagando correttamente come sopra. */
export class AmqpMeasurementEventPublisher implements MeasurementEventPublisher {
  private constructor(private readonly resilient: ResilientAmqpConnection<ConfirmChannel>) {}

  static async connect(url: string, logger: Logger): Promise<AmqpMeasurementEventPublisher> {
    const resilient = await connectResilientAmqp<ConfirmChannel>({
      url,
      logger,
      openChannel: (connection) => connection.createConfirmChannel(),
      setup: async (channel) => {
        await channel.assertQueue(MEASUREMENT_SAVE_REQUESTED_QUEUE, { durable: true });
      },
    });
    return new AmqpMeasurementEventPublisher(resilient);
  }

  async publishMeasurementSaveRequested(event: MeasurementSaveRequestedEvent): Promise<void> {
    const channel = this.resilient.getChannel();
    if (!channel) {
      throw new Error("Canale RabbitMQ non disponibile.");
    }
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
    await this.resilient.close();
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

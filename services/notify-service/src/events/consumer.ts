import amqplib, { type Channel, type ConsumeMessage } from "amqplib";
import { PROGRESSION_EVENTS_QUEUE, type ProgressionEventMessage } from "@gym-tracker/shared";
import { z } from "zod";
import type { NotificationService } from "../domain/notification-service.js";

const progressionEventMessageSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string().min(1),
  triggeringSessionId: z.string().uuid(),
  suggestionType: z.enum(["increase_weight", "increase_reps"]),
  previousValue: z.number().nullable(),
  suggestedValue: z.number().nullable(),
  reason: z.string().min(1),
  source: z.enum(["rule", "ai"]),
  createdAt: z.string(),
  ownerId: z.string().uuid(),
});

/**
 * Pura: valida il JSON grezzo dalla coda (attraversa un confine di servizio
 * non tipizzato, a differenza delle rotte HTTP dove zod valida gia' al
 * bordo). Lancia se il messaggio non rispetta il contratto.
 */
export function parseProgressionEventMessage(raw: Buffer): ProgressionEventMessage {
  const json: unknown = JSON.parse(raw.toString("utf8"));
  return progressionEventMessageSchema.parse(json);
}

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Consumer {
  close(): Promise<void>;
}

/**
 * Si connette a RabbitMQ (retry con backoff, stesso pattern del publisher di
 * progress-service: `depends_on: rabbitmq: condition: service_healthy` in
 * docker-compose non e' una garanzia assoluta) e consuma dalla coda
 * "progression-events" con ack manuale (`prefetch(1)`: un messaggio alla
 * volta, elaborato prima di prendere il successivo).
 *
 * Un messaggio malformato viene loggato e scartato (ack comunque): ritentare
 * all'infinito un messaggio che non potra' mai essere elaborato bloccherebbe
 * la coda per tutti gli altri (nessun dead-letter exchange in v1).
 */
export async function startConsumer(url: string, service: NotificationService): Promise<Consumer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      const connection = await amqplib.connect(url);
      const channel = await connection.createChannel();
      await channel.assertQueue(PROGRESSION_EVENTS_QUEUE, { durable: true });
      await channel.prefetch(1);
      connection.on("error", (err) => {
        // eslint-disable-next-line no-console
        console.error("[notify-service] connessione RabbitMQ interrotta:", err);
      });

      await channel.consume(PROGRESSION_EVENTS_QUEUE, (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }
        void handleMessage(channel, msg, service);
      });

      return {
        close: async () => {
          await channel.close();
          await connection.close();
        },
      };
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

async function handleMessage(
  channel: Channel,
  msg: ConsumeMessage,
  service: NotificationService
): Promise<void> {
  try {
    const event = parseProgressionEventMessage(msg.content);
    await service.handleProgressionEvent(event);
    channel.ack(msg);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notify-service] messaggio scartato (parsing/elaborazione fallita):", err);
    channel.ack(msg);
  }
}

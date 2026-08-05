import type { Channel, ConsumeMessage } from "amqplib";
import { connectResilientAmqp } from "./amqp-connection.js";
import type { Logger } from "./logger.js";

/**
 * Ricetta di affidabilita' condivisa per ogni consumer RabbitMQ del progetto
 * (notify-service, history-service, account-service, progress-service):
 * retry immediato in-process, poi retry con backoff via una coda di attesa
 * dedicata, poi una coda di dead-letter finale + callback opzionale (es. email
 * a un contatto operativo). Nessun plugin RabbitMQ necessario: il backoff usa
 * il TTL per-messaggio (`expiration`) su un'unica coda di attesa invece di N
 * code con TTL diversi, e il conteggio dei tentativi legge l'header `x-death`
 * che RabbitMQ aggiorna da solo ad ogni dead-lettering per scadenza TTL.
 */

export interface QueueNames {
  work: string;
  retry: string;
  deadLetter: string;
}

export function queueNamesFor(baseName: string): QueueNames {
  return {
    work: baseName,
    retry: `${baseName}.retry`,
    deadLetter: `${baseName}.dead-letter`,
  };
}

interface XDeathEntry {
  queue?: string;
  count?: number;
}

/** Quante volte questo messaggio e' gia' passato dalla coda di retry (0 se mai). */
export function countRetryAttempts(
  headers: Record<string, unknown> | undefined,
  retryQueueName: string
): number {
  const xDeath = headers?.["x-death"] as XDeathEntry[] | undefined;
  const entry = xDeath?.find((d) => d.queue === retryQueueName);
  return entry?.count ?? 0;
}

/** Ritardo (ms) per il prossimo tentativo di backoff, o null se esauriti (-> dead-letter). */
export function nextBackoffDelayMs(
  attemptsSoFar: number,
  backoffDelaysMs: readonly number[]
): number | null {
  if (attemptsSoFar >= backoffDelaysMs.length) {
    return null;
  }
  return backoffDelaysMs[attemptsSoFar] ?? null;
}

export const DEFAULT_IMMEDIATE_RETRIES = 2;
export const DEFAULT_BACKOFF_DELAYS_MS = [10_000, 30_000, 60_000, 300_000, 900_000] as const;

export interface ReliableConsumer {
  close(): Promise<void>;
}

export type DeadLetterReason = "poison" | "exhausted-retries";

export interface ReliableConsumerOptions<T> {
  connectionUrl: string;
  queueName: string;
  logger: Logger;
  /** Pura: lancia per un messaggio non processabile (JSON/schema invalido).
   *  Non e' recuperabile con un retry, va dritto in dead-letter. */
  parseMessage: (raw: Buffer) => T;
  /** Lancia per un fallimento transitorio (es. DB irraggiungibile): recuperabile,
   *  segue retry immediato -> backoff -> dead-letter. */
  handle: (message: T) => Promise<void>;
  /** Chiamata quando un messaggio finisce in dead-letter (poison o retry esauriti);
   *  un suo eventuale errore viene loggato ma non blocca il consumo degli altri messaggi. */
  onDeadLetter?: (raw: Buffer, reason: DeadLetterReason, error: unknown) => Promise<void>;
  immediateRetries?: number;
  backoffDelaysMs?: readonly number[];
}

async function handleDelivery<T>(
  channel: Channel,
  msg: ConsumeMessage,
  names: QueueNames,
  options: ReliableConsumerOptions<T>
): Promise<void> {
  const immediateRetries = options.immediateRetries ?? DEFAULT_IMMEDIATE_RETRIES;
  const backoffDelaysMs = options.backoffDelaysMs ?? DEFAULT_BACKOFF_DELAYS_MS;

  let parsed: T;
  try {
    parsed = options.parseMessage(msg.content);
  } catch (err) {
    options.logger.error({ err }, "messaggio non processabile (poison), spostato in dead-letter");
    channel.sendToQueue(names.deadLetter, msg.content, {
      persistent: true,
      headers: msg.properties.headers,
    });
    channel.ack(msg);
    await notifyDeadLetter(options, msg.content, "poison", err);
    return;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= immediateRetries; attempt++) {
    try {
      await options.handle(parsed);
      channel.ack(msg);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  const attemptsSoFar = countRetryAttempts(msg.properties.headers, names.retry);
  const delay = nextBackoffDelayMs(attemptsSoFar, backoffDelaysMs);
  if (delay !== null) {
    options.logger.error(
      { err: lastError, attemptsSoFar, nextDelayMs: delay },
      "elaborazione fallita, ripianificato con backoff"
    );
    channel.sendToQueue(names.retry, msg.content, {
      persistent: true,
      expiration: String(delay),
      headers: msg.properties.headers,
    });
    channel.ack(msg);
    return;
  }

  options.logger.error(
    { err: lastError, attemptsSoFar },
    "retry esauriti, messaggio spostato in dead-letter"
  );
  channel.sendToQueue(names.deadLetter, msg.content, {
    persistent: true,
    headers: msg.properties.headers,
  });
  channel.ack(msg);
  await notifyDeadLetter(options, msg.content, "exhausted-retries", lastError);
}

async function notifyDeadLetter<T>(
  options: ReliableConsumerOptions<T>,
  raw: Buffer,
  reason: DeadLetterReason,
  error: unknown
): Promise<void> {
  try {
    await options.onDeadLetter?.(raw, reason, error);
  } catch (err) {
    options.logger.error({ err }, "notifica di dead-letter fallita (es. invio email)");
  }
}

/**
 * Si connette a RabbitMQ (retry con backoff all'avvio, poi riconnessione
 * automatica se la connessione cade in seguito -- vedi amqp-connection.ts)
 * e consuma dalla coda `queueName` con ack manuale (`prefetch(1)`),
 * applicando la ricetta di affidabilita' sopra. Le code di retry/dead-letter
 * vengono dichiarate insieme a quella di lavoro, e ridichiarate (no-op,
 * `assertQueue` e' idempotente) ad ogni riconnessione insieme al consumer,
 * che va sempre riregistrato sul nuovo canale.
 */
export async function startReliableConsumer<T>(
  options: ReliableConsumerOptions<T>
): Promise<ReliableConsumer> {
  const names = queueNamesFor(options.queueName);

  const resilient = await connectResilientAmqp({
    url: options.connectionUrl,
    logger: options.logger,
    openChannel: (connection) => connection.createChannel(),
    setup: async (channel) => {
      await channel.assertQueue(names.work, { durable: true });
      await channel.assertQueue(names.retry, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": names.work,
        },
      });
      await channel.assertQueue(names.deadLetter, { durable: true });
      await channel.prefetch(1);
      await channel.consume(names.work, (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }
        void handleDelivery(channel, msg, names, options);
      });
    },
  });

  return {
    close: () => resilient.close(),
  };
}

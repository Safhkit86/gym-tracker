import amqplib, { type Channel, type ChannelModel, type ConfirmChannel } from "amqplib";
import type { Logger } from "./logger.js";

/**
 * Connessione AMQP resiliente, usata sia dai publisher che da
 * `startReliableConsumer` (vedi queue-reliability.ts) al posto di aprire
 * `amqplib.connect` a mano in ogni servizio.
 *
 * Prima di questo helper, ogni connessione (consumer e i quattro publisher
 * duplicati in giro per i servizi) riprovava solo all'avvio: se la
 * connessione cadeva *dopo* essere partita (es. "Heartbeat timeout" per la
 * macchina di sviluppo che va in sospensione, o un riavvio del broker),
 * l'handler `connection.on("error", ...)` si limitava a loggare l'errore e
 * la connessione restava morta per sempre, finche' qualcuno non riavviava
 * il container a mano -- il servizio nel frattempo continuava a rispondere
 * "healthy" su `/health` (server HTTP separato), quindi il problema non era
 * visibile finche' non si notava che smettevano di arrivare eventi/notifiche.
 * Bug reale osservato su progress-service e history-service dopo una
 * sospensione della macchina (vedi CLAUDE.md).
 */

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_CONNECT_RETRY_DELAY_MS = 500;
/** Ritardo tra un tentativo di riconnessione e il successivo dopo l'avvio
 *  (a differenza del backoff esponenziale di `connectWithRetry`, qui non
 *  c'e' fretta: il servizio e' gia' avviato e serve solo un ritardo che non
 *  martelli il broker mentre e' giu'). */
const RECONNECT_RETRY_DELAY_MS = 2000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ResilientAmqpConnection<C extends Channel | ConfirmChannel> {
  /** Il canale corrente, o null nella finestra tra una disconnessione e la
   *  riconnessione automatica successiva -- i chiamanti (publish, o il
   *  callback di consume registrato da `setup`) devono gestire questo caso,
   *  esattamente come gestivano gia' un canale mai connesso. */
  getChannel: () => C | null;
  close: () => Promise<void>;
}

export interface ConnectResilientAmqpOptions<C extends Channel | ConfirmChannel> {
  url: string;
  logger: Logger;
  /** Apre il tipo di canale che serve al chiamante (semplice o confirm). */
  openChannel: (connection: ChannelModel) => Promise<C>;
  /** Dichiara code/prefetch/consumer sul canale -- richiamata sia alla prima
   *  connessione sia, identica, ad ogni riconnessione (deve essere
   *  idempotente: gli `assertQueue` lo sono gia' per natura). */
  setup: (channel: C) => Promise<void>;
}

/**
 * Si connette con retry (backoff) all'avvio -- invariato rispetto a prima,
 * `depends_on: rabbitmq: condition: service_healthy` in docker-compose non
 * e' una garanzia assoluta -- e in piu' si riconnette automaticamente (retry
 * a intervalli fissi, indefinitamente) se la connessione cade *dopo*
 * essere partita.
 */
export async function connectResilientAmqp<C extends Channel | ConfirmChannel>(
  options: ConnectResilientAmqpOptions<C>
): Promise<ResilientAmqpConnection<C>> {
  let channel: C | null = null;
  let connection: ChannelModel | null = null;
  let closedByCaller = false;

  async function connectOnce(): Promise<void> {
    const conn = await amqplib.connect(options.url);
    const ch = await options.openChannel(conn);
    await options.setup(ch);
    connection = conn;
    channel = ch;

    conn.on("error", (err) => {
      options.logger.error({ err }, "connessione RabbitMQ interrotta");
    });
    conn.on("close", () => {
      channel = null;
      connection = null;
      if (!closedByCaller) {
        void reconnectLoop();
      }
    });
  }

  async function connectWithRetry(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        await connectOnce();
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_CONNECT_ATTEMPTS) {
          await wait(BASE_CONNECT_RETRY_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }
    throw new Error(
      `Impossibile connettersi a RabbitMQ dopo ${MAX_CONNECT_ATTEMPTS} tentativi: ${String(lastError)}`
    );
  }

  async function reconnectLoop(): Promise<void> {
    while (!closedByCaller && !channel) {
      try {
        await connectOnce();
        options.logger.info({}, "riconnesso a RabbitMQ");
      } catch (err) {
        options.logger.error(
          { err },
          "riconnessione a RabbitMQ fallita, nuovo tentativo tra breve"
        );
        await wait(RECONNECT_RETRY_DELAY_MS);
      }
    }
  }

  await connectWithRetry();

  return {
    getChannel: () => channel,
    close: async () => {
      closedByCaller = true;
      await channel?.close();
      await connection?.close();
      channel = null;
      connection = null;
    },
  };
}

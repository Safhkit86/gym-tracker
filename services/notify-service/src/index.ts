import {
  createAccessTokenService,
  createLogger,
  createNodemailerMailer,
  startReliableConsumer,
  PROGRESSION_EVENTS_QUEUE,
} from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { NotificationService } from "./domain/notification-service.js";
import { parseProgressionEventMessage } from "./events/consumer.js";
import { KyselyNotificationRepository } from "./repositories/notification-repository.js";

const config = loadConfig();
const logger = createLogger("notify-service");

const db = createDb(config.DATABASE_URL);
const notifications = new KyselyNotificationRepository(db);
const notificationService = new NotificationService(notifications);

const mailer = createNodemailerMailer({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  from: config.SMTP_FROM,
  auth:
    config.SMTP_USER && config.SMTP_PASSWORD
      ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
      : undefined,
});

const consumer = await startReliableConsumer({
  connectionUrl: config.RABBITMQ_URL,
  queueName: PROGRESSION_EVENTS_QUEUE,
  logger,
  parseMessage: parseProgressionEventMessage,
  handle: (event) => notificationService.handleProgressionEvent(event),
  onDeadLetter: async (raw, reason, error) => {
    await mailer.send({
      to: config.OPS_ALERT_EMAIL,
      subject: `gym-tracker: messaggio in dead-letter (${PROGRESSION_EVENTS_QUEUE})`,
      text: [
        `Coda: ${PROGRESSION_EVENTS_QUEUE}`,
        `Motivo: ${reason === "poison" ? "messaggio non processabile" : "retry esauriti"}`,
        `Errore: ${String(error)}`,
        "",
        "Messaggio originale:",
        raw.toString("utf8"),
      ].join("\n"),
    });
  },
});

const app = createApp({
  notifications,
  tokens: createAccessTokenService(config.JWT_SECRET),
  logger,
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "listening");
});

// Chiusura pulita: termina il pool Postgres e la connessione RabbitMQ allo spegnimento.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.destroy();
      void consumer.close();
    });
  });
}

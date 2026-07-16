import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { NotificationService } from "./domain/notification-service.js";
import { startConsumer } from "./events/consumer.js";
import { KyselyNotificationRepository } from "./repositories/notification-repository.js";

const config = loadConfig();
const logger = createLogger("notify-service");

const db = createDb(config.DATABASE_URL);
const notifications = new KyselyNotificationRepository(db);
const notificationService = new NotificationService(notifications);

const consumer = await startConsumer(config.RABBITMQ_URL, notificationService, logger);

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

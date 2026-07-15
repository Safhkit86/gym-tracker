import { createAccessTokenService } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { NotificationService } from "./domain/notification-service.js";
import { startConsumer } from "./events/consumer.js";
import { KyselyNotificationRepository } from "./repositories/notification-repository.js";

const config = loadConfig();

const db = createDb(config.DATABASE_URL);
const notifications = new KyselyNotificationRepository(db);
const notificationService = new NotificationService(notifications);

const consumer = await startConsumer(config.RABBITMQ_URL, notificationService);

const app = createApp({
  notifications,
  tokens: createAccessTokenService(config.JWT_SECRET),
});

const server = app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[notify-service] listening on port ${config.PORT}`);
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

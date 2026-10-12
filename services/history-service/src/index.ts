import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { AmqpSessionEventPublisher } from "./events/publisher.js";
import { AmqpMeasurementEventPublisher } from "./events/measurement-events-publisher.js";
import { startMeasurementEventsConsumer } from "./events/measurement-events-consumer.js";
import { startUserDeletedConsumer } from "./events/user-deleted-consumer.js";
import { KyselySessionRepository } from "./repositories/session-repository.js";
import { KyselyStatsRepository } from "./repositories/stats-repository.js";
import { KyselyMeasurementEntryRepository } from "./repositories/measurement-entry-repository.js";

const config = loadConfig();
const logger = createLogger("history-service");

const db = createDb(config.DATABASE_URL);
const publisher = await AmqpSessionEventPublisher.connect(config.RABBITMQ_URL, logger);
const measurementPublisher = await AmqpMeasurementEventPublisher.connect(
  config.RABBITMQ_URL,
  logger
);
const measurementEntries = new KyselyMeasurementEntryRepository(db);
const sessions = new KyselySessionRepository(db);
const measurementEventsConsumer = await startMeasurementEventsConsumer({
  connectionUrl: config.RABBITMQ_URL,
  logger,
  measurementEntries,
  publisher: measurementPublisher,
});
const userDeletedConsumer = await startUserDeletedConsumer({
  connectionUrl: config.RABBITMQ_URL,
  logger,
  sessions,
  measurementEntries,
});

const app = createApp({
  sessions,
  stats: new KyselyStatsRepository(db),
  measurementEntries,
  publisher,
  tokens: createAccessTokenService(config.JWT_SECRET),
  logger,
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "listening");
});

// Chiusura pulita: termina il pool Postgres e le connessioni RabbitMQ allo spegnimento.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.destroy();
      void publisher.close?.();
      void measurementPublisher.close?.();
      void measurementEventsConsumer.close();
      void userDeletedConsumer.close();
    });
  });
}

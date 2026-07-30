import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { AmqpProgressionEventPublisher } from "./events/publisher.js";
import { startSessionEventsConsumer } from "./events/session-events-consumer.js";
import { KyselyProgressionEventRepository } from "./repositories/progression-event-repository.js";
import { KyselyProgressionPreferencesRepository } from "./repositories/progression-preferences-repository.js";
import { KyselyProgressionDefaultsRepository } from "./repositories/progression-defaults-repository.js";
import { KyselyExerciseHistoryCacheRepository } from "./repositories/exercise-history-cache-repository.js";
import { KyselyProcessedSessionsRepository } from "./repositories/processed-sessions-repository.js";

const config = loadConfig();
const logger = createLogger("progress-service");

const db = createDb(config.DATABASE_URL);
const publisher = await AmqpProgressionEventPublisher.connect(config.RABBITMQ_URL, logger);

const progressionEvents = new KyselyProgressionEventRepository(db);
const progressionPreferences = new KyselyProgressionPreferencesRepository(db);
const progressionDefaults = new KyselyProgressionDefaultsRepository(db);
const exerciseHistoryCache = new KyselyExerciseHistoryCacheRepository(db);
const processedSessions = new KyselyProcessedSessionsRepository(db);

const sessionEventsConsumer = await startSessionEventsConsumer({
  connectionUrl: config.RABBITMQ_URL,
  logger,
  progressionEvents,
  progressionPreferences,
  progressionDefaults,
  exerciseHistoryCache,
  processedSessions,
  publisher,
});

const app = createApp({
  progressionEvents,
  progressionPreferences,
  progressionDefaults,
  exerciseHistoryCache,
  processedSessions,
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
      void sessionEventsConsumer.close();
    });
  });
}

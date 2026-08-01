import { Redis } from "ioredis";
import {
  createAccessTokenService,
  createLogger,
  createNodemailerMailer,
} from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { argon2Hasher } from "./domain/password.js";
import { KyselyUserRepository } from "./repositories/user-repository.js";
import { KyselyPasswordActionTokenRepository } from "./repositories/password-action-token-repository.js";
import { KyselyUserMeasurementsRepository } from "./repositories/user-measurements-repository.js";
import { KyselyAccountPreferencesRepository } from "./repositories/account-preferences-repository.js";
import { RedisMeasurementCacheRepository } from "./repositories/measurement-cache-repository.js";
import { AmqpMeasurementEventPublisher } from "./events/measurement-events-publisher.js";
import { startMeasurementEventsConsumer } from "./events/measurement-events-consumer.js";

const config = loadConfig();
const logger = createLogger("account-service");

const db = createDb(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL);
const measurementCache = new RedisMeasurementCacheRepository(redis);
const measurementEventPublisher = await AmqpMeasurementEventPublisher.connect(
  config.RABBITMQ_URL,
  logger
);
const measurementEventsConsumer = await startMeasurementEventsConsumer({
  connectionUrl: config.RABBITMQ_URL,
  logger,
  measurementCache,
});

const app = createApp({
  users: new KyselyUserRepository(db),
  passwordActionTokens: new KyselyPasswordActionTokenRepository(db),
  measurements: new KyselyUserMeasurementsRepository(db),
  measurementCache,
  measurementEventPublisher,
  accountPreferences: new KyselyAccountPreferencesRepository(db),
  passwords: argon2Hasher,
  tokens: createAccessTokenService(config.JWT_SECRET),
  mailer: createNodemailerMailer({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    from: config.SMTP_FROM,
    auth:
      config.SMTP_USER && config.SMTP_PASSWORD
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
  }),
  webAppUrl: config.WEB_APP_URL,
  logger,
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "listening");
});

// Chiusura pulita: termina il pool Postgres e le connessioni Redis/RabbitMQ allo spegnimento.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.destroy();
      redis.disconnect();
      void measurementEventPublisher.close?.();
      void measurementEventsConsumer.close();
    });
  });
}

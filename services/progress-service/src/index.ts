import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { AmqpProgressionEventPublisher } from "./events/publisher.js";
import { KyselyProgressionEventRepository } from "./repositories/progression-event-repository.js";
import { KyselySessionRepository } from "./repositories/session-repository.js";

const config = loadConfig();
const logger = createLogger("progress-service");

const db = createDb(config.DATABASE_URL);
const publisher = await AmqpProgressionEventPublisher.connect(config.RABBITMQ_URL, logger);

const app = createApp({
  sessions: new KyselySessionRepository(db),
  progressionEvents: new KyselyProgressionEventRepository(db),
  publisher,
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
      void publisher.close?.();
    });
  });
}

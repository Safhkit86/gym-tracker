import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { AmqpSessionEventPublisher } from "./events/publisher.js";
import { KyselySessionRepository } from "./repositories/session-repository.js";
import { KyselyStatsRepository } from "./repositories/stats-repository.js";

const config = loadConfig();
const logger = createLogger("history-service");

const db = createDb(config.DATABASE_URL);
const publisher = await AmqpSessionEventPublisher.connect(config.RABBITMQ_URL, logger);

const app = createApp({
  sessions: new KyselySessionRepository(db),
  stats: new KyselyStatsRepository(db),
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

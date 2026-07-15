import { createAccessTokenService } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { AmqpProgressionEventPublisher } from "./events/publisher.js";
import { KyselyProgressionEventRepository } from "./repositories/progression-event-repository.js";
import { KyselySessionRepository } from "./repositories/session-repository.js";

const config = loadConfig();

const db = createDb(config.DATABASE_URL);
const publisher = await AmqpProgressionEventPublisher.connect(config.RABBITMQ_URL);

const app = createApp({
  sessions: new KyselySessionRepository(db),
  progressionEvents: new KyselyProgressionEventRepository(db),
  publisher,
  tokens: createAccessTokenService(config.JWT_SECRET),
});

const server = app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[progress-service] listening on port ${config.PORT}`);
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

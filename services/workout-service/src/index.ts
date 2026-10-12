import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { KyselyExerciseRepository } from "./repositories/exercise-repository.js";
import { KyselyWorkoutRepository } from "./repositories/workout-repository.js";
import { startUserDeletedConsumer } from "./events/user-deleted-consumer.js";

const config = loadConfig();
const logger = createLogger("workout-service");

const db = createDb(config.DATABASE_URL);
const exercises = new KyselyExerciseRepository(db);
const workouts = new KyselyWorkoutRepository(db);

const userDeletedConsumer = await startUserDeletedConsumer({
  connectionUrl: config.RABBITMQ_URL,
  logger,
  workouts,
  exercises,
});

const app = createApp({
  exercises,
  workouts,
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
      void userDeletedConsumer.close();
    });
  });
}

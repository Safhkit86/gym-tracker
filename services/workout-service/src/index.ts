import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { KyselyExerciseRepository } from "./repositories/exercise-repository.js";
import { KyselyWorkoutRepository } from "./repositories/workout-repository.js";

const config = loadConfig();
const logger = createLogger("workout-service");

const db = createDb(config.DATABASE_URL);

const app = createApp({
  exercises: new KyselyExerciseRepository(db),
  workouts: new KyselyWorkoutRepository(db),
  tokens: createAccessTokenService(config.JWT_SECRET),
  logger,
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "listening");
});

// Chiusura pulita: termina il pool Postgres allo spegnimento.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.destroy();
    });
  });
}

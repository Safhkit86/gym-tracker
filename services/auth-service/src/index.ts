import { createAccessTokenService } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { argon2Hasher } from "./domain/password.js";
import { KyselyUserRepository } from "./repositories/user-repository.js";

const config = loadConfig();

const db = createDb(config.DATABASE_URL);

const app = createApp({
  users: new KyselyUserRepository(db),
  passwords: argon2Hasher,
  tokens: createAccessTokenService(config.JWT_SECRET),
});

const server = app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[auth-service] listening on port ${config.PORT}`);
});

// Chiusura pulita: termina il pool Postgres allo spegnimento.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.destroy();
    });
  });
}

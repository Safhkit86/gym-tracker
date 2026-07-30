import { createAccessTokenService, createLogger } from "@gym-tracker/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { argon2Hasher } from "./domain/password.js";
import { createNodemailerMailer } from "./domain/mailer.js";
import { KyselyUserRepository } from "./repositories/user-repository.js";
import { KyselyPasswordActionTokenRepository } from "./repositories/password-action-token-repository.js";
import { KyselyUserMeasurementsRepository } from "./repositories/user-measurements-repository.js";
import { KyselyAccountPreferencesRepository } from "./repositories/account-preferences-repository.js";

const config = loadConfig();
const logger = createLogger("account-service");

const db = createDb(config.DATABASE_URL);

const app = createApp({
  users: new KyselyUserRepository(db),
  passwordActionTokens: new KyselyPasswordActionTokenRepository(db),
  measurements: new KyselyUserMeasurementsRepository(db),
  accountPreferences: new KyselyAccountPreferencesRepository(db),
  passwords: argon2Hasher,
  tokens: createAccessTokenService(config.JWT_SECRET),
  mailer: createNodemailerMailer({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    from: config.SMTP_FROM,
  }),
  webAppUrl: config.WEB_APP_URL,
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

import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Carica il .env di root (non quello del singolo servizio) per l'esecuzione
// sull'host (`npm run dev`/`db:migrate` fuori da Docker): li' le variabili
// non arrivano gia' impostate come fa docker-compose. Non sovrascrive
// variabili gia' presenti in process.env; se il file non esiste (es. dentro
// l'immagine Docker, dove .env non viene copiato) non fa nulla.
loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

/**
 * Configurazione da variabili d'ambiente. Usata solo dall'entry point reale
 * (index.ts) e dallo script di migrazione; i test costruiscono l'app con
 * dipendenze finte e non passano di qui.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4002),
  DATABASE_URL: z.string().url(),
  // min(32): vedi commento nello stesso punto di api-gateway/src/config.ts.
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve essere lungo almeno 32 caratteri"),
  // Per consumare user-deleted-workout (cancellazione account, vedi
  // AccountDeletionService in account-service): prima workout-service non
  // aveva ancora nessun consumer RabbitMQ.
  RABBITMQ_URL: z.string().url(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configurazione non valida: ${issues}`);
  }
  return parsed.data;
}

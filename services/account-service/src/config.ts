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
 * Configurazione letta e validata dalle variabili d'ambiente all'avvio.
 * Usata solo dall'entry point reale (index.ts) e dallo script di migrazione:
 * i test costruiscono l'app con dipendenze finte e non passano di qui.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET non puo' essere vuoto"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().min(1).default("no-reply@gym-tracker.local"),
  // Assenti con Mailpit (nessuna autenticazione); un vero relay SMTP le
  // richiede entrambe, vedi createNodemailerMailer in @gym-tracker/shared.
  // Il preprocess tratta "" come non impostata: docker-compose.prod.yml usa
  // "${SMTP_USER:-}", che senza un valore reale passa una stringa vuota
  // (non la variabile assente), altrimenti bocciata da min(1).
  SMTP_USER: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  SMTP_PASSWORD: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  WEB_APP_URL: z.string().url().default("http://localhost:5173"),
  RABBITMQ_URL: z.string().url(),
  REDIS_URL: z.string().url(),
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

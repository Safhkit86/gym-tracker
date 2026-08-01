import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Carica il .env di root (non quello del singolo servizio) per l'esecuzione
// sull'host (`npm run dev`/`db:migrate` fuori da Docker): li' le variabili
// non arrivano gia' impostate come fa docker-compose. Non sovrascrive
// variabili gia' presenti in process.env; se il file non esiste (es. dentro
// l'immagine Docker, dove .env non viene copiato) non fa nulla.
loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4004),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET non puo' essere vuoto"),
  RABBITMQ_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),
  // Assenti con Mailpit (nessuna autenticazione); un vero relay SMTP le
  // richiede entrambe, vedi createNodemailerMailer in @gym-tracker/shared.
  // Il preprocess tratta "" come non impostata: docker-compose.prod.yml usa
  // "${SMTP_USER:-}", che senza un valore reale passa una stringa vuota
  // (non la variabile assente), altrimenti bocciata da min(1).
  SMTP_USER: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  SMTP_PASSWORD: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  /** Contatto operativo avvisato quando un messaggio finisce in dead-letter
   *  (nessun nuovo ruolo/utente applicativo: e' solo un indirizzo email). */
  OPS_ALERT_EMAIL: z.string().email(),
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

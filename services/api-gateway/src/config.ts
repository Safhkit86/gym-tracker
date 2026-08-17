import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Carica il .env di root per l'esecuzione sull'host (`npm run dev` fuori da
// Docker): li' le variabili non arrivano gia' impostate come fa
// docker-compose. Non sovrascrive variabili gia' presenti in process.env; se
// il file non esiste (es. dentro l'immagine Docker) non fa nulla.
loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

/**
 * Configurazione da variabili d'ambiente. Usata solo dall'entry point reale
 * (index.ts); i test costruiscono l'app con target di upstream finti.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  ACCOUNT_SERVICE_URL: z.string().url(),
  WORKOUT_SERVICE_URL: z.string().url(),
  PROGRESS_SERVICE_URL: z.string().url(),
  HISTORY_SERVICE_URL: z.string().url(),
  NOTIFY_SERVICE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET non puo' essere vuoto"),
  // Opzionali, default = gli stessi valori hardcoded in rate-limit.ts (nessuna
  // di queste var impostata => comportamento identico a prima). Esistono
  // solo per poter alzare il limite globale in sviluppo (docker-compose.yml,
  // dove un giro di test manuale/emulatore puo' facilmente superare 300
  // richieste in 15 minuti) senza toccare il default di produzione.
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_SENSITIVE_MAX: z.coerce.number().int().positive().default(20),
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

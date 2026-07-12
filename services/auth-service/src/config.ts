import { z } from "zod";

/**
 * Configurazione letta e validata dalle variabili d'ambiente all'avvio.
 * Usata solo dall'entry point reale (index.ts) e dallo script di migrazione:
 * i test costruiscono l'app con dipendenze finte e non passano di qui.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET non puo' essere vuoto"),
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

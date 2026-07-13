import { z } from "zod";

/**
 * Configurazione da variabili d'ambiente. Usata solo dall'entry point reale
 * (index.ts); i test costruiscono l'app con target di upstream finti.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  AUTH_SERVICE_URL: z.string().url(),
  WORKOUT_SERVICE_URL: z.string().url(),
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

import { type ProgressionEventMessage } from "@gym-tracker/shared";
import { z } from "zod";

const progressionEventMessageSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string().min(1),
  triggeringSessionId: z.string().uuid(),
  suggestionType: z.enum(["increase_weight", "increase_reps"]),
  previousValue: z.number().nullable(),
  suggestedValue: z.number().nullable(),
  reason: z.string().min(1),
  source: z.enum(["rule", "ai"]),
  createdAt: z.string(),
  userId: z.string().uuid(),
});

/**
 * Pura: valida il JSON grezzo dalla coda (attraversa un confine di servizio
 * non tipizzato, a differenza delle rotte HTTP dove zod valida gia' al
 * bordo). Lancia se il messaggio non rispetta il contratto: e' un messaggio
 * "poison" per `startReliableConsumer` (non recuperabile con un retry, va
 * dritto in dead-letter).
 */
export function parseProgressionEventMessage(raw: Buffer): ProgressionEventMessage {
  const json: unknown = JSON.parse(raw.toString("utf8"));
  return progressionEventMessageSchema.parse(json);
}

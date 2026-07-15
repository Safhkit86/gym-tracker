/**
 * Contratti di notify-service: notifiche in-app generate a partire dagli
 * eventi di progressione pubblicati da progress-service (coda RabbitMQ
 * "progression-events"). Nessuna infrastruttura email/push: la webapp legge
 * queste notifiche via REST, stesso pattern gia' usato per i suggerimenti di
 * progressione in Fase 3.
 */

import type { ProgressionSuggestionType } from "./progress.js";

export interface Notification {
  id: string;
  exerciseId: string;
  exerciseName: string;
  suggestionType: ProgressionSuggestionType;
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
  triggeringSessionId: string;
  /** null = non letta. */
  readAt: string | null;
  createdAt: string;
}

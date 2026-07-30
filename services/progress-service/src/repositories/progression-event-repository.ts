import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { ProgressionEvent, ProgressionSuggestionType } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";

export interface NewProgressionEvent {
  userId: string;
  exerciseId: string;
  exerciseName: string;
  triggeringSessionId: string;
  suggestionType: ProgressionSuggestionType;
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
}

export interface ProgressionEventRepository {
  create(event: NewProgressionEvent): Promise<ProgressionEvent>;
  listByOwner(userId: string, exerciseId?: string): Promise<ProgressionEvent[]>;
  /** Per GET /sessions/:id/status (polling dopo il log): i suggerimenti
   *  generati da una sessione specifica. */
  listByTriggeringSession(sessionId: string): Promise<ProgressionEvent[]>;
  /** Cascade applicativo: sostituisce l'FK reale `ON DELETE CASCADE` di
   *  quando `progression_events` e `workout_sessions` vivevano nello stesso
   *  servizio (vedi migrazione 013), invocato dal consumer su
   *  `session-deleted`. */
  deleteByTriggeringSession(sessionId: string): Promise<void>;
}

export class KyselyProgressionEventRepository implements ProgressionEventRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(event: NewProgressionEvent): Promise<ProgressionEvent> {
    const row = await this.db
      .insertInto("progression_events")
      .values({
        user_id: event.userId,
        exercise_id: event.exerciseId,
        exercise_name: event.exerciseName,
        triggering_session_id: event.triggeringSessionId,
        suggestion_type: event.suggestionType,
        previous_value: event.previousValue,
        suggested_value: event.suggestedValue,
        reason: event.reason,
        source: "rule",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDto(row);
  }

  async listByOwner(userId: string, exerciseId?: string): Promise<ProgressionEvent[]> {
    let query = this.db.selectFrom("progression_events").selectAll().where("user_id", "=", userId);
    if (exerciseId) {
      query = query.where("exercise_id", "=", exerciseId);
    }
    const rows = await query.orderBy("created_at", "desc").execute();
    return rows.map(toDto);
  }

  async listByTriggeringSession(sessionId: string): Promise<ProgressionEvent[]> {
    const rows = await this.db
      .selectFrom("progression_events")
      .selectAll()
      .where("triggering_session_id", "=", sessionId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(toDto);
  }

  async deleteByTriggeringSession(sessionId: string): Promise<void> {
    await this.db
      .deleteFrom("progression_events")
      .where("triggering_session_id", "=", sessionId)
      .execute();
  }
}

function toDto(row: {
  id: string;
  exercise_id: string;
  exercise_name: string;
  triggering_session_id: string;
  suggestion_type: string;
  previous_value: string | null;
  suggested_value: string | null;
  reason: string;
  source: string;
  created_at: Date;
}): ProgressionEvent {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    triggeringSessionId: row.triggering_session_id,
    suggestionType: row.suggestion_type as ProgressionSuggestionType,
    previousValue: row.previous_value === null ? null : Number(row.previous_value),
    suggestedValue: row.suggested_value === null ? null : Number(row.suggested_value),
    reason: row.reason,
    source: row.source as "rule" | "ai",
    createdAt: row.created_at.toISOString(),
  };
}

// --- Implementazione in memoria per i test ---

export class InMemoryProgressionEventRepository implements ProgressionEventRepository {
  private readonly byOwner = new Map<string, ProgressionEvent[]>();

  async create(event: NewProgressionEvent): Promise<ProgressionEvent> {
    const created: ProgressionEvent = {
      id: randomUUID(),
      exerciseId: event.exerciseId,
      exerciseName: event.exerciseName,
      triggeringSessionId: event.triggeringSessionId,
      suggestionType: event.suggestionType,
      previousValue: event.previousValue,
      suggestedValue: event.suggestedValue,
      reason: event.reason,
      source: "rule",
      createdAt: new Date().toISOString(),
    };
    const list = this.byOwner.get(event.userId) ?? [];
    list.unshift(created);
    this.byOwner.set(event.userId, list);
    return created;
  }

  async listByOwner(userId: string, exerciseId?: string): Promise<ProgressionEvent[]> {
    const list = this.byOwner.get(userId) ?? [];
    return exerciseId ? list.filter((e) => e.exerciseId === exerciseId) : list;
  }

  async listByTriggeringSession(sessionId: string): Promise<ProgressionEvent[]> {
    return [...this.byOwner.values()].flat().filter((e) => e.triggeringSessionId === sessionId);
  }

  async deleteByTriggeringSession(sessionId: string): Promise<void> {
    for (const [userId, events] of this.byOwner.entries()) {
      this.byOwner.set(
        userId,
        events.filter((e) => e.triggeringSessionId !== sessionId)
      );
    }
  }
}

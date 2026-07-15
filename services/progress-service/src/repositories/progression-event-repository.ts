import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { ProgressionEvent, ProgressionSuggestionType } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";

export interface NewProgressionEvent {
  ownerId: string;
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
  listByOwner(ownerId: string, exerciseId?: string): Promise<ProgressionEvent[]>;
}

export class KyselyProgressionEventRepository implements ProgressionEventRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(event: NewProgressionEvent): Promise<ProgressionEvent> {
    const row = await this.db
      .insertInto("progression_events")
      .values({
        owner_id: event.ownerId,
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

  async listByOwner(ownerId: string, exerciseId?: string): Promise<ProgressionEvent[]> {
    let query = this.db
      .selectFrom("progression_events")
      .selectAll()
      .where("owner_id", "=", ownerId);
    if (exerciseId) {
      query = query.where("exercise_id", "=", exerciseId);
    }
    const rows = await query.orderBy("created_at", "desc").execute();
    return rows.map(toDto);
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
    const list = this.byOwner.get(event.ownerId) ?? [];
    list.unshift(created);
    this.byOwner.set(event.ownerId, list);
    return created;
  }

  async listByOwner(ownerId: string, exerciseId?: string): Promise<ProgressionEvent[]> {
    const list = this.byOwner.get(ownerId) ?? [];
    return exerciseId ? list.filter((e) => e.exerciseId === exerciseId) : list;
  }
}

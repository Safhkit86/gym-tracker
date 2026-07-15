import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import type { Notification, ProgressionSuggestionType } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";

export interface NewNotification {
  ownerId: string;
  exerciseId: string;
  exerciseName: string;
  suggestionType: ProgressionSuggestionType;
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
  triggeringSessionId: string;
  /** Id del ProgressionEvent originale, usato per deduplicare. */
  progressionEventId: string;
}

export interface ListOptions {
  unreadOnly?: boolean;
}

export interface NotificationRepository {
  /** null se gia' esistente (stesso owner+progressionEventId): nessun duplicato creato. */
  create(input: NewNotification): Promise<Notification | null>;
  listByOwner(ownerId: string, opts?: ListOptions): Promise<Notification[]>;
  /** true se la notifica esiste ed e' dell'owner (letta o meno). */
  markRead(ownerId: string, id: string): Promise<boolean>;
  /** Numero di notifiche segnate come lette. */
  markAllRead(ownerId: string): Promise<number>;
}

export class KyselyNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewNotification): Promise<Notification | null> {
    const row = await this.db
      .insertInto("notifications")
      .values({
        owner_id: input.ownerId,
        exercise_id: input.exerciseId,
        exercise_name: input.exerciseName,
        suggestion_type: input.suggestionType,
        previous_value: input.previousValue,
        suggested_value: input.suggestedValue,
        reason: input.reason,
        triggering_session_id: input.triggeringSessionId,
        progression_event_id: input.progressionEventId,
      })
      .onConflict((oc) => oc.columns(["owner_id", "progression_event_id"]).doNothing())
      .returningAll()
      .executeTakeFirst();
    return row ? toDto(row) : null;
  }

  async listByOwner(ownerId: string, opts: ListOptions = {}): Promise<Notification[]> {
    let query = this.db.selectFrom("notifications").selectAll().where("owner_id", "=", ownerId);
    if (opts.unreadOnly) {
      query = query.where("read_at", "is", null);
    }
    const rows = await query.orderBy("created_at", "desc").execute();
    return rows.map(toDto);
  }

  async markRead(ownerId: string, id: string): Promise<boolean> {
    const result = await this.db
      .updateTable("notifications")
      .set({ read_at: sql`coalesce(read_at, now())` })
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .executeTakeFirst();
    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  async markAllRead(ownerId: string): Promise<number> {
    const result = await this.db
      .updateTable("notifications")
      .set({ read_at: sql`now()` })
      .where("owner_id", "=", ownerId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0n);
  }
}

function toDto(row: {
  id: string;
  exercise_id: string;
  exercise_name: string;
  suggestion_type: string;
  previous_value: string | null;
  suggested_value: string | null;
  reason: string;
  triggering_session_id: string;
  read_at: Date | null;
  created_at: Date;
}): Notification {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    suggestionType: row.suggestion_type as ProgressionSuggestionType,
    previousValue: row.previous_value === null ? null : Number(row.previous_value),
    suggestedValue: row.suggested_value === null ? null : Number(row.suggested_value),
    reason: row.reason,
    triggeringSessionId: row.triggering_session_id,
    readAt: row.read_at === null ? null : row.read_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

// --- Implementazione in memoria per i test ---

interface StoredNotification {
  id: string;
  ownerId: string;
  progressionEventId: string;
  exerciseId: string;
  exerciseName: string;
  suggestionType: ProgressionSuggestionType;
  previousValue: number | null;
  suggestedValue: number | null;
  reason: string;
  triggeringSessionId: string;
  readAt: Date | null;
  createdAt: Date;
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly byId = new Map<string, StoredNotification>();

  async create(input: NewNotification): Promise<Notification | null> {
    const exists = [...this.byId.values()].some(
      (n) => n.ownerId === input.ownerId && n.progressionEventId === input.progressionEventId
    );
    if (exists) {
      return null;
    }
    const stored: StoredNotification = {
      id: randomUUID(),
      ownerId: input.ownerId,
      progressionEventId: input.progressionEventId,
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      suggestionType: input.suggestionType,
      previousValue: input.previousValue,
      suggestedValue: input.suggestedValue,
      reason: input.reason,
      triggeringSessionId: input.triggeringSessionId,
      readAt: null,
      createdAt: new Date(),
    };
    this.byId.set(stored.id, stored);
    return toStoredDto(stored);
  }

  async listByOwner(ownerId: string, opts: ListOptions = {}): Promise<Notification[]> {
    return [...this.byId.values()]
      .filter((n) => n.ownerId === ownerId)
      .filter((n) => !opts.unreadOnly || n.readAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toStoredDto);
  }

  async markRead(ownerId: string, id: string): Promise<boolean> {
    const stored = this.byId.get(id);
    if (!stored || stored.ownerId !== ownerId) {
      return false;
    }
    stored.readAt ??= new Date();
    return true;
  }

  async markAllRead(ownerId: string): Promise<number> {
    let count = 0;
    for (const stored of this.byId.values()) {
      if (stored.ownerId === ownerId && stored.readAt === null) {
        stored.readAt = new Date();
        count++;
      }
    }
    return count;
  }
}

function toStoredDto(n: StoredNotification): Notification {
  return {
    id: n.id,
    exerciseId: n.exerciseId,
    exerciseName: n.exerciseName,
    suggestionType: n.suggestionType,
    previousValue: n.previousValue,
    suggestedValue: n.suggestedValue,
    reason: n.reason,
    triggeringSessionId: n.triggeringSessionId,
    readAt: n.readAt === null ? null : n.readAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
  };
}

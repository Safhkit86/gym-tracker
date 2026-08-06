import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import type { Notification, ProgressionSuggestionType } from "@gym-tracker/shared";
import type { Database } from "../db/types.js";

export interface NewNotification {
  userId: string;
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
  listByOwner(userId: string, opts?: ListOptions): Promise<Notification[]>;
  /** true se la notifica esiste ed e' dell'owner (letta o meno). */
  markRead(userId: string, id: string): Promise<boolean>;
  /**
   * Come markRead, ma per un'accettazione: segna anche come lette (non
   * accettate) le eventuali notifiche precedenti ancora non lette dello
   * stesso esercizio — un suggerimento più recente per lo stesso esercizio
   * accettato rende obsoleti quelli più vecchi non ancora gestiti, che
   * altrimenti resterebbero "da accettare" all'infinito (vedi
   * notification-service.ts per le regole complete). true se la notifica
   * accettata esiste ed e' dell'owner.
   */
  acceptWithCascade(userId: string, id: string): Promise<boolean>;
  /** Numero di notifiche segnate come lette. */
  markAllRead(userId: string): Promise<number>;
}

export class KyselyNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewNotification): Promise<Notification | null> {
    const row = await this.db
      .insertInto("notifications")
      .values({
        user_id: input.userId,
        exercise_id: input.exerciseId,
        exercise_name: input.exerciseName,
        suggestion_type: input.suggestionType,
        previous_value: input.previousValue,
        suggested_value: input.suggestedValue,
        reason: input.reason,
        triggering_session_id: input.triggeringSessionId,
        progression_event_id: input.progressionEventId,
      })
      .onConflict((oc) => oc.columns(["user_id", "progression_event_id"]).doNothing())
      .returningAll()
      .executeTakeFirst();
    return row ? toDto(row) : null;
  }

  async listByOwner(userId: string, opts: ListOptions = {}): Promise<Notification[]> {
    let query = this.db.selectFrom("notifications").selectAll().where("user_id", "=", userId);
    if (opts.unreadOnly) {
      query = query.where("read_at", "is", null);
    }
    const rows = await query.orderBy("created_at", "desc").execute();
    return rows.map(toDto);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .updateTable("notifications")
      .set({ read_at: sql`coalesce(read_at, now())` })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  async acceptWithCascade(userId: string, id: string): Promise<boolean> {
    const accepted = await this.db
      .updateTable("notifications")
      .set({ read_at: sql`coalesce(read_at, now())` })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .returning(["exercise_id", "created_at"])
      .executeTakeFirst();
    if (!accepted) {
      return false;
    }
    await this.db
      .updateTable("notifications")
      .set({ read_at: sql`now()` })
      .where("user_id", "=", userId)
      .where("exercise_id", "=", accepted.exercise_id)
      .where("read_at", "is", null)
      .where("created_at", "<", accepted.created_at)
      .execute();
    return true;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.db
      .updateTable("notifications")
      .set({ read_at: sql`now()` })
      .where("user_id", "=", userId)
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
  userId: string;
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
  // Contatore monotono usato solo per createdAt: due create() ravvicinate
  // nello stesso test (nessun vero delay tra loro) possono ricadere nello
  // stesso millisecondo di Date.now(), rendendo il confronto "<" di
  // acceptWithCascade inaffidabile (l'ordine di creazione andrebbe perso).
  // Sommare un contatore garantisce un ordine strettamente crescente che
  // rispecchia l'ordine di chiamata, come farebbe in pratica la risoluzione
  // a microsecondi di Postgres tra due INSERT reali.
  private createSequence = 0;

  async create(input: NewNotification): Promise<Notification | null> {
    const exists = [...this.byId.values()].some(
      (n) => n.userId === input.userId && n.progressionEventId === input.progressionEventId
    );
    if (exists) {
      return null;
    }
    const stored: StoredNotification = {
      id: randomUUID(),
      userId: input.userId,
      progressionEventId: input.progressionEventId,
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      suggestionType: input.suggestionType,
      previousValue: input.previousValue,
      suggestedValue: input.suggestedValue,
      reason: input.reason,
      triggeringSessionId: input.triggeringSessionId,
      readAt: null,
      createdAt: new Date(Date.now() + this.createSequence++),
    };
    this.byId.set(stored.id, stored);
    return toStoredDto(stored);
  }

  async listByOwner(userId: string, opts: ListOptions = {}): Promise<Notification[]> {
    return [...this.byId.values()]
      .filter((n) => n.userId === userId)
      .filter((n) => !opts.unreadOnly || n.readAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toStoredDto);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const stored = this.byId.get(id);
    if (!stored || stored.userId !== userId) {
      return false;
    }
    stored.readAt ??= new Date();
    return true;
  }

  async acceptWithCascade(userId: string, id: string): Promise<boolean> {
    const accepted = this.byId.get(id);
    if (!accepted || accepted.userId !== userId) {
      return false;
    }
    accepted.readAt ??= new Date();
    for (const stored of this.byId.values()) {
      if (
        stored.userId === userId &&
        stored.exerciseId === accepted.exerciseId &&
        stored.readAt === null &&
        stored.createdAt.getTime() < accepted.createdAt.getTime()
      ) {
        stored.readAt = new Date();
      }
    }
    return true;
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0;
    for (const stored of this.byId.values()) {
      if (stored.userId === userId && stored.readAt === null) {
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

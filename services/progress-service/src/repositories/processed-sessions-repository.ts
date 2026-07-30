import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

export interface ProcessedSessionStatus {
  userId: string;
  hadSuggestions: boolean;
}

export interface ProcessedSessionsRepository {
  /** Scritto dal consumer di `session-logged` a valutazione completata:
   *  segnala a GET /sessions/:id/status che il polling puo' smettere di
   *  aspettare. */
  markProcessed(sessionId: string, userId: string, hadSuggestions: boolean): Promise<void>;
  /** null se il consumer non ha ancora processato quella sessione (stato
   *  "pending" per chi fa polling). Include `userId` per verificare
   *  l'ownership lato route (questo servizio non ha piu' la tabella delle
   *  sessioni per una join). */
  findStatus(sessionId: string): Promise<ProcessedSessionStatus | null>;
}

export class KyselyProcessedSessionsRepository implements ProcessedSessionsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async markProcessed(sessionId: string, userId: string, hadSuggestions: boolean): Promise<void> {
    await this.db
      .insertInto("processed_sessions")
      .values({ session_id: sessionId, user_id: userId, had_suggestions: hadSuggestions })
      .onConflict((oc) => oc.column("session_id").doUpdateSet({ had_suggestions: hadSuggestions }))
      .execute();
  }

  async findStatus(sessionId: string): Promise<ProcessedSessionStatus | null> {
    const row = await this.db
      .selectFrom("processed_sessions")
      .select(["user_id", "had_suggestions"])
      .where("session_id", "=", sessionId)
      .executeTakeFirst();
    return row ? { userId: row.user_id, hadSuggestions: row.had_suggestions } : null;
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryProcessedSessionsRepository implements ProcessedSessionsRepository {
  private readonly byId = new Map<string, ProcessedSessionStatus>();

  async markProcessed(sessionId: string, userId: string, hadSuggestions: boolean): Promise<void> {
    this.byId.set(sessionId, { userId, hadSuggestions });
  }

  async findStatus(sessionId: string): Promise<ProcessedSessionStatus | null> {
    return this.byId.get(sessionId) ?? null;
  }
}

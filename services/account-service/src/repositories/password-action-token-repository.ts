import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database, PasswordActionPurpose } from "../db/types.js";

/** Riga cosi' com'e' persistita (include l'hash del token/OTP, mai il valore in chiaro). */
export interface PasswordActionTokenRecord {
  id: string;
  userId: string;
  purpose: PasswordActionPurpose;
  tokenHash: string;
  pendingPasswordHash: string | null;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface NewPasswordActionToken {
  userId: string;
  purpose: PasswordActionPurpose;
  tokenHash: string;
  pendingPasswordHash?: string | null;
  expiresAt: Date;
}

export interface PasswordActionTokenRepository {
  create(token: NewPasswordActionToken): Promise<PasswordActionTokenRecord>;
  findByHash(
    tokenHash: string,
    purpose: PasswordActionPurpose
  ): Promise<PasswordActionTokenRecord | null>;
  /** Token attivo (non scaduto, non usato) piu' recente per user+purpose: usato per il cooldown. */
  findLatestActive(
    userId: string,
    purpose: PasswordActionPurpose
  ): Promise<PasswordActionTokenRecord | null>;
  incrementAttempts(id: string): Promise<number>;
  markUsed(id: string): Promise<void>;
}

interface PasswordActionTokenRow {
  id: string;
  user_id: string;
  purpose: PasswordActionPurpose;
  token_hash: string;
  pending_password_hash: string | null;
  attempts: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

function toRecord(row: PasswordActionTokenRow): PasswordActionTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    tokenHash: row.token_hash,
    pendingPasswordHash: row.pending_password_hash,
    attempts: row.attempts,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

/** Implementazione su Postgres via Kysely. */
export class KyselyPasswordActionTokenRepository implements PasswordActionTokenRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(token: NewPasswordActionToken): Promise<PasswordActionTokenRecord> {
    const row = await this.db
      .insertInto("password_action_tokens")
      .values({
        user_id: token.userId,
        purpose: token.purpose,
        token_hash: token.tokenHash,
        pending_password_hash: token.pendingPasswordHash ?? null,
        expires_at: token.expiresAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async findByHash(
    tokenHash: string,
    purpose: PasswordActionPurpose
  ): Promise<PasswordActionTokenRecord | null> {
    const row = await this.db
      .selectFrom("password_action_tokens")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .where("purpose", "=", purpose)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async findLatestActive(
    userId: string,
    purpose: PasswordActionPurpose
  ): Promise<PasswordActionTokenRecord | null> {
    const row = await this.db
      .selectFrom("password_action_tokens")
      .selectAll()
      .where("user_id", "=", userId)
      .where("purpose", "=", purpose)
      .where("used_at", "is", null)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async incrementAttempts(id: string): Promise<number> {
    const row = await this.db
      .updateTable("password_action_tokens")
      .set((eb) => ({ attempts: eb("attempts", "+", 1) }))
      .where("id", "=", id)
      .returning("attempts")
      .executeTakeFirstOrThrow();
    return row.attempts;
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .updateTable("password_action_tokens")
      .set({ used_at: new Date() })
      .where("id", "=", id)
      .execute();
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryPasswordActionTokenRepository implements PasswordActionTokenRepository {
  private readonly byId = new Map<string, PasswordActionTokenRecord>();

  async create(token: NewPasswordActionToken): Promise<PasswordActionTokenRecord> {
    const record: PasswordActionTokenRecord = {
      id: randomUUID(),
      userId: token.userId,
      purpose: token.purpose,
      tokenHash: token.tokenHash,
      pendingPasswordHash: token.pendingPasswordHash ?? null,
      attempts: 0,
      expiresAt: token.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.byId.set(record.id, record);
    return record;
  }

  async findByHash(
    tokenHash: string,
    purpose: PasswordActionPurpose
  ): Promise<PasswordActionTokenRecord | null> {
    for (const record of this.byId.values()) {
      if (record.tokenHash === tokenHash && record.purpose === purpose) {
        return record;
      }
    }
    return null;
  }

  async findLatestActive(
    userId: string,
    purpose: PasswordActionPurpose
  ): Promise<PasswordActionTokenRecord | null> {
    let latest: PasswordActionTokenRecord | null = null;
    for (const record of this.byId.values()) {
      if (record.userId !== userId || record.purpose !== purpose || record.usedAt !== null) {
        continue;
      }
      if (!latest || record.createdAt > latest.createdAt) {
        latest = record;
      }
    }
    return latest;
  }

  async incrementAttempts(id: string): Promise<number> {
    const record = this.byId.get(id);
    if (!record) {
      return 0;
    }
    const updated = { ...record, attempts: record.attempts + 1 };
    this.byId.set(id, updated);
    return updated.attempts;
  }

  async markUsed(id: string): Promise<void> {
    const record = this.byId.get(id);
    if (!record) {
      return;
    }
    this.byId.set(id, { ...record, usedAt: new Date() });
  }
}

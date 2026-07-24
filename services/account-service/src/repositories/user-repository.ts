import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

/** Utente cosi' com'e' persistito (include il password hash). */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(user: NewUser): Promise<UserRecord>;
  /** Aggiorna l'hash della password e registra `passwordChangedAt` (solo audit). */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Implementazione su Postgres via Kysely. */
export class KyselyUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async create(user: NewUser): Promise<UserRecord> {
    const row = await this.db
      .insertInto("users")
      .values({ email: user.email, password_hash: user.passwordHash })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        password_hash: passwordHash,
        password_changed_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }
}

/** Implementazione in memoria: usata nei test per evitare un DB reale. */
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.byId.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async create(user: NewUser): Promise<UserRecord> {
    const now = new Date();
    const record: UserRecord = {
      id: randomUUID(),
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(record.id, record);
    return record;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const record = this.byId.get(id);
    if (!record) {
      return;
    }
    this.byId.set(id, { ...record, passwordHash, updatedAt: new Date() });
  }
}

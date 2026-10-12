import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import type { Database } from "../db/types.js";

/** Utente cosi' com'e' persistito (include il password hash). */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface NewUser {
  email: string;
  passwordHash: string;
}

/** Esito dell'incremento atomico dei tentativi falliti, vedi sotto. */
export interface FailedLoginResult {
  attempts: number;
  /** Non null solo se QUESTO tentativo ha appena fatto scattare il lockout
   *  (soglia raggiunta ora, non un lockout preesistente). */
  lockedUntil: Date | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(user: NewUser): Promise<UserRecord>;
  /** Aggiorna l'hash della password e registra `passwordChangedAt` (solo audit). */
  updatePassword(id: string, passwordHash: string): Promise<void>;
  /**
   * Incrementa atomicamente failed_login_attempts e, se la nuova soglia
   * raggiunge maxAttempts, imposta locked_until a lockUntilIfExceeded —
   * in un solo giro verso il DB, per evitare la race tra lettura e
   * scrittura separate sotto richieste concorrenti sullo stesso account.
   */
  incrementFailedLoginAttempts(
    id: string,
    maxAttempts: number,
    lockUntilIfExceeded: Date
  ): Promise<FailedLoginResult>;
  /** Azzera il contatore e rimuove un eventuale lockout (login riuscito, o
   *  lockout scaduto che va ripulito prima di contare un nuovo tentativo). */
  resetFailedLoginAttempts(id: string): Promise<void>;
  /** Cancella l'utente e, a cascata (FK ON DELETE CASCADE, vedi migrazioni
   *  002/003/004), i suoi password_action_tokens/user_measurements/
   *  account_preferences. Non tocca gli altri servizi: vedi
   *  AccountDeletionService per il fan-out via RabbitMQ. */
  deleteById(id: string): Promise<void>;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  failed_login_attempts: number;
  locked_until: Date | null;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
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

  async incrementFailedLoginAttempts(
    id: string,
    maxAttempts: number,
    lockUntilIfExceeded: Date
  ): Promise<FailedLoginResult> {
    const row = await this.db
      .updateTable("users")
      .set({
        failed_login_attempts: sql`failed_login_attempts + 1`,
        // CASE sul valore GIA' incrementato (failed_login_attempts + 1, non
        // la colonna pre-update): altrimenti il confronto con maxAttempts
        // scatterebbe un tentativo tardi. "ELSE locked_until" lascia
        // invariato un lockout preesistente (nessun effetto qui: chi
        // chiama ha gia' azzerato un lockout scaduto prima di arrivare a
        // questa query, vedi AuthService.login).
        locked_until: sql`CASE WHEN failed_login_attempts + 1 >= ${maxAttempts} THEN ${lockUntilIfExceeded} ELSE locked_until END`,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returning(["failed_login_attempts", "locked_until"])
      .executeTakeFirstOrThrow();
    return { attempts: row.failed_login_attempts, lockedUntil: row.locked_until };
  }

  async resetFailedLoginAttempts(id: string): Promise<void> {
    await this.db
      .updateTable("users")
      .set({ failed_login_attempts: 0, locked_until: null, updated_at: new Date() })
      .where("id", "=", id)
      .execute();
  }

  async deleteById(id: string): Promise<void> {
    await this.db.deleteFrom("users").where("id", "=", id).execute();
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
      failedLoginAttempts: 0,
      lockedUntil: null,
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

  async incrementFailedLoginAttempts(
    id: string,
    maxAttempts: number,
    lockUntilIfExceeded: Date
  ): Promise<FailedLoginResult> {
    const record = this.byId.get(id);
    if (!record) {
      return { attempts: 0, lockedUntil: null };
    }
    const attempts = record.failedLoginAttempts + 1;
    const lockedUntil = attempts >= maxAttempts ? lockUntilIfExceeded : record.lockedUntil;
    this.byId.set(id, {
      ...record,
      failedLoginAttempts: attempts,
      lockedUntil,
      updatedAt: new Date(),
    });
    return { attempts, lockedUntil: attempts >= maxAttempts ? lockUntilIfExceeded : null };
  }

  async resetFailedLoginAttempts(id: string): Promise<void> {
    const record = this.byId.get(id);
    if (!record) {
      return;
    }
    this.byId.set(id, {
      ...record,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    });
  }

  async deleteById(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

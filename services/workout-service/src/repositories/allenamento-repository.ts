import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

/** Riga grezza di un allenamento, senza workoutCount: lo calcola il domain
 *  (AllenamentoService) componendo con WorkoutRepository, cosi' il conteggio
 *  ha un'unica fonte di verita' (le schede stesse) invece di essere
 *  duplicato/ricalcolato qui e nell'implementazione in memoria dei test. */
export interface AllenamentoRow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AllenamentoRepository {
  listByOwner(userId: string): Promise<AllenamentoRow[]>;
  /** null se l'utente non ha ancora nessun allenamento (utente nuovo, vedi
   *  AllenamentoService.resolveAllenamentoId). */
  findActiveByOwner(userId: string): Promise<AllenamentoRow | null>;
  /** Verifica proprieta': usato per validare un allenamentoId passato su
   *  POST/PUT /workouts prima di assegnarlo. */
  findByOwner(userId: string, id: string): Promise<AllenamentoRow | null>;
  /** Il nuovo allenamento NON e' attivo di default (vedi commento in
   *  AllenamentoService): l'attivazione e' un'azione esplicita separata. */
  create(userId: string, name: string): Promise<AllenamentoRow>;
  /** null se non esiste o non e' dell'utente. */
  rename(userId: string, id: string, name: string): Promise<AllenamentoRow | null>;
  /** Disattiva atomicamente l'eventuale allenamento attivo precedente e
   *  attiva questo. null se non esiste o non e' dell'utente. */
  setActive(userId: string, id: string): Promise<AllenamentoRow | null>;
  /** true se cancellato, false se non esiste/non e' dell'utente. Il
   *  controllo "non deve contenere schede"/"non deve essere l'attivo" e'
   *  nel domain (AllenamentoService), non qui: questo repository esegue
   *  solo la cancellazione incondizionata. */
  delete(userId: string, id: string): Promise<boolean>;
  /** Usato dal consumer di user-deleted-workout (cancellazione account,
   *  GDPR) — va chiamato DOPO workouts.deleteAllForUser (FK). */
  deleteAllForUser(userId: string): Promise<void>;
}

export class KyselyAllenamentoRepository implements AllenamentoRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async listByOwner(userId: string): Promise<AllenamentoRow[]> {
    const rows = await this.db
      .selectFrom("allenamenti")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toDto);
  }

  async findActiveByOwner(userId: string): Promise<AllenamentoRow | null> {
    const row = await this.db
      .selectFrom("allenamenti")
      .selectAll()
      .where("user_id", "=", userId)
      .where("is_active", "=", true)
      .executeTakeFirst();
    return row ? toDto(row) : null;
  }

  async findByOwner(userId: string, id: string): Promise<AllenamentoRow | null> {
    const row = await this.db
      .selectFrom("allenamenti")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? toDto(row) : null;
  }

  async create(userId: string, name: string): Promise<AllenamentoRow> {
    const row = await this.db
      .insertInto("allenamenti")
      .values({ user_id: userId, name, is_active: false })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDto(row);
  }

  async rename(userId: string, id: string, name: string): Promise<AllenamentoRow | null> {
    const row = await this.db
      .updateTable("allenamenti")
      .set({ name, updated_at: new Date() })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .returningAll()
      .executeTakeFirst();
    return row ? toDto(row) : null;
  }

  async setActive(userId: string, id: string): Promise<AllenamentoRow | null> {
    return this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom("allenamenti")
        .select("id")
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      if (!existing) {
        return null;
      }
      // L'indice unico parziale (is_active = true) rifiuterebbe due righe
      // attive per lo stesso utente: disattiva prima l'eventuale precedente.
      await trx
        .updateTable("allenamenti")
        .set({ is_active: false, updated_at: new Date() })
        .where("user_id", "=", userId)
        .where("is_active", "=", true)
        .execute();
      const row = await trx
        .updateTable("allenamenti")
        .set({ is_active: true, updated_at: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return toDto(row);
    });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("allenamenti")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
    return (result[0]?.numDeletedRows ?? 0n) > 0n;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.deleteFrom("allenamenti").where("user_id", "=", userId).execute();
  }
}

function toDto(row: {
  id: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): AllenamentoRow {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// --- Implementazione in memoria per i test ---

interface StoredAllenamento {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryAllenamentoRepository implements AllenamentoRepository {
  private readonly byId = new Map<string, StoredAllenamento>();

  async listByOwner(userId: string): Promise<AllenamentoRow[]> {
    return [...this.byId.values()]
      .filter((a) => a.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toRow);
  }

  async findActiveByOwner(userId: string): Promise<AllenamentoRow | null> {
    const found = [...this.byId.values()].find((a) => a.userId === userId && a.isActive);
    return found ? toRow(found) : null;
  }

  async findByOwner(userId: string, id: string): Promise<AllenamentoRow | null> {
    const found = this.byId.get(id);
    return found && found.userId === userId ? toRow(found) : null;
  }

  async create(userId: string, name: string): Promise<AllenamentoRow> {
    const now = new Date();
    const stored: StoredAllenamento = {
      id: randomUUID(),
      userId,
      name,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(stored.id, stored);
    return toRow(stored);
  }

  async rename(userId: string, id: string, name: string): Promise<AllenamentoRow | null> {
    const existing = this.byId.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    const updated = { ...existing, name, updatedAt: new Date() };
    this.byId.set(id, updated);
    return toRow(updated);
  }

  async setActive(userId: string, id: string): Promise<AllenamentoRow | null> {
    const existing = this.byId.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    for (const a of this.byId.values()) {
      if (a.userId === userId && a.isActive) {
        this.byId.set(a.id, { ...a, isActive: false, updatedAt: new Date() });
      }
    }
    const updated = { ...existing, isActive: true, updatedAt: new Date() };
    this.byId.set(id, updated);
    return toRow(updated);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = this.byId.get(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.byId.delete(id);
    return true;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [id, a] of this.byId) {
      if (a.userId === userId) {
        this.byId.delete(id);
      }
    }
  }
}

function toRow(a: StoredAllenamento): AllenamentoRow {
  return {
    id: a.id,
    name: a.name,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

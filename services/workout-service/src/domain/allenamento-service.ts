import type { AllenamentoSummary } from "@gym-tracker/shared";
import { ConflictError, NotFoundError } from "../errors.js";
import type {
  AllenamentoRepository,
  AllenamentoRow,
} from "../repositories/allenamento-repository.js";
import type { WorkoutRepository } from "../repositories/workout-repository.js";

/**
 * Logica degli allenamenti (gruppi di schede). Il conteggio schede per
 * allenamento (workoutCount) ha un'unica fonte di verita', le schede stesse
 * (WorkoutRepository): il repository degli allenamenti non lo calcola,
 * evitando di duplicarlo/tenerlo sincronizzato in due posti (vedi commento
 * in AllenamentoRow).
 */
export class AllenamentoService {
  constructor(
    private readonly allenamenti: AllenamentoRepository,
    private readonly workouts: WorkoutRepository
  ) {}

  async list(userId: string): Promise<AllenamentoSummary[]> {
    const [rows, allWorkouts] = await Promise.all([
      this.allenamenti.listByOwner(userId),
      this.workouts.listByOwner(userId),
    ]);
    const countById = new Map<string, number>();
    for (const w of allWorkouts) {
      countById.set(w.allenamentoId, (countById.get(w.allenamentoId) ?? 0) + 1);
    }
    return rows.map((row) => this.toSummary(row, countById.get(row.id) ?? 0));
  }

  async create(userId: string, name: string): Promise<AllenamentoSummary> {
    const created = await this.allenamenti.create(userId, name);
    return this.toSummary(created, 0);
  }

  async rename(userId: string, id: string, name: string): Promise<AllenamentoSummary> {
    const updated = await this.allenamenti.rename(userId, id, name);
    if (!updated) {
      throw new NotFoundError("Allenamento non trovato.");
    }
    return this.withWorkoutCount(userId, updated);
  }

  async setActive(userId: string, id: string): Promise<AllenamentoSummary> {
    const updated = await this.allenamenti.setActive(userId, id);
    if (!updated) {
      throw new NotFoundError("Allenamento non trovato.");
    }
    return this.withWorkoutCount(userId, updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.allenamenti.findByOwner(userId, id);
    if (!existing) {
      throw new NotFoundError("Allenamento non trovato.");
    }
    if (existing.isActive) {
      throw new ConflictError(
        "ALLENAMENTO_IS_ACTIVE",
        "Non puoi eliminare l'allenamento attivo: rendine attivo un altro prima."
      );
    }
    const workoutsInIt = await this.workouts.listByOwner(userId, id);
    if (workoutsInIt.length > 0) {
      throw new ConflictError(
        "ALLENAMENTO_NOT_EMPTY",
        "Sposta o elimina prima le schede di questo allenamento."
      );
    }
    const total = await this.allenamenti.listByOwner(userId);
    if (total.length <= 1) {
      throw new ConflictError(
        "ALLENAMENTO_LAST_ONE",
        "Non puoi eliminare il tuo unico allenamento."
      );
    }
    await this.allenamenti.delete(userId, id);
  }

  /**
   * Risolve l'allenamentoId da assegnare a una scheda in creazione/modifica:
   * quello esplicitamente richiesto (verificandone la proprieta'), altrimenti
   * l'allenamento attivo dell'utente. Un utente senza ancora nessun
   * allenamento (caso nuovo, prima scheda mai creata dopo la migrazione 018)
   * ne riceve uno di default, attivo — cosi' il flusso "crea scheda" resta
   * identico a prima dell'introduzione degli allenamenti, senza passaggi in
   * piu' per chi non ha ancora bisogno di raggrupparle.
   */
  async resolveAllenamentoId(
    userId: string,
    requestedId: string | null | undefined
  ): Promise<string> {
    if (requestedId) {
      const owned = await this.allenamenti.findByOwner(userId, requestedId);
      if (!owned) {
        throw new NotFoundError("Allenamento non trovato.");
      }
      return owned.id;
    }
    const active = await this.allenamenti.findActiveByOwner(userId);
    if (active) {
      return active.id;
    }
    const created = await this.allenamenti.create(userId, "Allenamento 1");
    const activated = await this.allenamenti.setActive(userId, created.id);
    // Appena creato e attivato: non puo' essere null.
    return (activated as AllenamentoRow).id;
  }

  private async withWorkoutCount(userId: string, row: AllenamentoRow): Promise<AllenamentoSummary> {
    const workoutsInIt = await this.workouts.listByOwner(userId, row.id);
    return this.toSummary(row, workoutsInIt.length);
  }

  private toSummary(row: AllenamentoRow, workoutCount: number): AllenamentoSummary {
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      workoutCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

import type { WorkoutDetail, WorkoutInput, WorkoutSummary } from "@gym-tracker/shared";
import { BadRequestError, NotFoundError } from "../errors.js";
import type { ExerciseRepository } from "../repositories/exercise-repository.js";
import type { NormalizedWorkout, WorkoutRepository } from "../repositories/workout-repository.js";

/**
 * Logica delle schede. La validazione strutturale del body (nomi, range,
 * posizioni uniche) avviene con zod al confine della rotta; qui si fa la
 * validazione che richiede il DB (gli esercizi referenziati esistono e sono
 * accessibili all'utente) e si applicano le regole di proprieta'.
 */
export class WorkoutService {
  constructor(
    private readonly workouts: WorkoutRepository,
    private readonly exercises: ExerciseRepository
  ) {}

  async create(ownerId: string, input: WorkoutInput): Promise<WorkoutDetail> {
    const normalized = await this.normalize(ownerId, input);
    return this.workouts.create(ownerId, normalized);
  }

  async replace(ownerId: string, id: string, input: WorkoutInput): Promise<WorkoutDetail> {
    const normalized = await this.normalize(ownerId, input);
    const result = await this.workouts.replace(ownerId, id, normalized);
    if (!result) {
      throw new NotFoundError("Scheda non trovata.");
    }
    return result;
  }

  async list(ownerId: string): Promise<WorkoutSummary[]> {
    return this.workouts.listByOwner(ownerId);
  }

  async get(ownerId: string, id: string): Promise<WorkoutDetail> {
    const detail = await this.workouts.findDetail(ownerId, id);
    if (!detail) {
      throw new NotFoundError("Scheda non trovata.");
    }
    return detail;
  }

  async delete(ownerId: string, id: string): Promise<void> {
    const deleted = await this.workouts.delete(ownerId, id);
    if (!deleted) {
      throw new NotFoundError("Scheda non trovata.");
    }
  }

  async reorder(ownerId: string, workoutIds: string[]): Promise<void> {
    await this.workouts.reorder(ownerId, workoutIds);
  }

  /** Verifica gli esercizi referenziati e risolve i loro nomi dal catalogo. */
  private async normalize(ownerId: string, input: WorkoutInput): Promise<NormalizedWorkout> {
    const exercises = input.exercises ?? [];
    const ids = [...new Set(exercises.map((e) => e.exerciseId))];
    const accessible = await this.exercises.findAccessibleByIds(ownerId, ids);
    const nameById = new Map(accessible.map((e) => [e.id, e.name]));

    const missing = ids.filter((id) => !nameById.has(id));
    if (missing.length > 0) {
      throw new BadRequestError(
        "INVALID_EXERCISE_REFERENCE",
        "Uno o piu' esercizi non esistono o non sono accessibili.",
        { exerciseIds: missing }
      );
    }

    return {
      name: input.name,
      notes: input.notes ?? null,
      exercises: exercises.map((e) => ({
        exerciseId: e.exerciseId,
        // Presente per certo: gli id mancanti sono gia' stati respinti sopra.
        exerciseName: nameById.get(e.exerciseId) as string,
        position: e.position,
        notes: e.notes ?? null,
        restSeconds: e.restSeconds ?? null,
        progressionIncrement: e.progressionIncrement ?? null,
        sets: e.sets.map((s) => ({
          setNumber: s.setNumber,
          targetMinReps: s.targetMinReps,
          targetMaxReps: s.targetMaxReps ?? null,
          targetWeight: s.targetWeight ?? null,
          restSeconds: s.restSeconds ?? null,
        })),
      })),
    };
  }
}

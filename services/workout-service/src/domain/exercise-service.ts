import type { CreateExerciseRequest, Exercise } from "@gym-tracker/shared";
import type { ExerciseRecord, ExerciseRepository } from "../repositories/exercise-repository.js";

function toDto(record: ExerciseRecord): Exercise {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    muscleGroup: record.muscleGroup,
    description: record.description,
    sourceUrl: record.sourceUrl,
  };
}

/** Logica del catalogo esercizi: elenco (globali + propri) e creazione. */
export class ExerciseService {
  constructor(private readonly exercises: ExerciseRepository) {}

  async listAvailable(userId: string): Promise<Exercise[]> {
    const records = await this.exercises.listAvailable(userId);
    return records.map(toDto);
  }

  async create(userId: string, input: CreateExerciseRequest): Promise<Exercise> {
    const muscleGroup = input.muscleGroup?.trim();
    const record = await this.exercises.create({
      userId,
      name: input.name.trim(),
      muscleGroup: muscleGroup ? muscleGroup : null,
    });
    return toDto(record);
  }
}

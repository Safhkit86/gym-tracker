import { describe, it, expect } from "vitest";
import { createLogger } from "@gym-tracker/shared";
import {
  handleUserDeleted,
  type UserDeletedConsumerDeps,
} from "../src/events/user-deleted-consumer.js";
import { InMemoryWorkoutRepository } from "../src/repositories/workout-repository.js";
import { InMemoryExerciseRepository } from "../src/repositories/exercise-repository.js";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function buildDeps(): UserDeletedConsumerDeps & {
  workouts: InMemoryWorkoutRepository;
  exercises: InMemoryExerciseRepository;
} {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("workout-service", { level: "silent" }),
    workouts: new InMemoryWorkoutRepository(),
    exercises: new InMemoryExerciseRepository([{ name: "Panca piana", muscleGroup: "Petto" }]),
  };
}

describe("handleUserDeleted", () => {
  it("cancella tutte le schede e gli esercizi custom dell'utente", async () => {
    const deps = buildDeps();
    const exercise = await deps.exercises.create({ userId: USER_A, name: "Squat mio", muscleGroup: null });
    await deps.workouts.create(USER_A, {
      name: "Scheda A",
      notes: null,
      exercises: [
        {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          position: 1,
          notes: null,
          restSeconds: null,
          progressionIncrement: null,
          sets: [],
        },
      ],
    });

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.workouts.listByOwner(USER_A)).toHaveLength(0);
    expect(await deps.exercises.listAvailable(USER_A)).not.toContainEqual(
      expect.objectContaining({ id: exercise.id })
    );
  });

  it("non tocca le schede/esercizi di un altro utente", async () => {
    const deps = buildDeps();
    await deps.workouts.create(USER_B, { name: "Scheda B", notes: null, exercises: [] });
    const exerciseB = await deps.exercises.create({
      userId: USER_B,
      name: "Esercizio di B",
      muscleGroup: null,
    });

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.workouts.listByOwner(USER_B)).toHaveLength(1);
    expect(await deps.exercises.listAvailable(USER_B)).toContainEqual(
      expect.objectContaining({ id: exerciseB.id })
    );
  });

  it("non tocca il catalogo globale (esercizi senza owner)", async () => {
    const deps = buildDeps();

    await handleUserDeleted({ userId: USER_A }, deps);

    const globalExercises = await deps.exercises.listAvailable(USER_B);
    expect(globalExercises.some((e) => e.name === "Panca piana")).toBe(true);
  });
});

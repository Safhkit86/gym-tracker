import { describe, it, expect } from "vitest";
import { createLogger } from "@gym-tracker/shared";
import {
  handleUserDeleted,
  type UserDeletedConsumerDeps,
} from "../src/events/user-deleted-consumer.js";
import { InMemoryWorkoutRepository } from "../src/repositories/workout-repository.js";
import { InMemoryExerciseRepository } from "../src/repositories/exercise-repository.js";
import { InMemoryAllenamentoRepository } from "../src/repositories/allenamento-repository.js";

const USER_A = "11111111-1111-1111-a111-111111111111";
const USER_B = "22222222-2222-2222-a222-222222222222";

function buildDeps(): UserDeletedConsumerDeps & {
  workouts: InMemoryWorkoutRepository;
  exercises: InMemoryExerciseRepository;
  allenamenti: InMemoryAllenamentoRepository;
} {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("workout-service", { level: "silent" }),
    workouts: new InMemoryWorkoutRepository(),
    exercises: new InMemoryExerciseRepository([{ name: "Panca piana", muscleGroup: "Petto" }]),
    allenamenti: new InMemoryAllenamentoRepository(),
  };
}

describe("handleUserDeleted", () => {
  it("cancella tutte le schede, gli allenamenti e gli esercizi custom dell'utente", async () => {
    const deps = buildDeps();
    const allenamento = await deps.allenamenti.create(USER_A, "Allenamento 1");
    const exercise = await deps.exercises.create({
      userId: USER_A,
      name: "Squat mio",
      muscleGroup: null,
    });
    await deps.workouts.create(USER_A, {
      name: "Scheda A",
      notes: null,
      allenamentoId: allenamento.id,
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
    expect(await deps.allenamenti.listByOwner(USER_A)).toHaveLength(0);
    expect(await deps.exercises.listAvailable(USER_A)).not.toContainEqual(
      expect.objectContaining({ id: exercise.id })
    );
  });

  it("non tocca le schede/allenamenti/esercizi di un altro utente", async () => {
    const deps = buildDeps();
    const allenamentoB = await deps.allenamenti.create(USER_B, "Allenamento di B");
    await deps.workouts.create(USER_B, {
      name: "Scheda B",
      notes: null,
      allenamentoId: allenamentoB.id,
      exercises: [],
    });
    const exerciseB = await deps.exercises.create({
      userId: USER_B,
      name: "Esercizio di B",
      muscleGroup: null,
    });

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.workouts.listByOwner(USER_B)).toHaveLength(1);
    expect(await deps.allenamenti.listByOwner(USER_B)).toHaveLength(1);
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

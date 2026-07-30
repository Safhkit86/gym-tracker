import { describe, it, expect } from "vitest";
import { InMemoryExerciseHistoryCacheRepository } from "../src/repositories/exercise-history-cache-repository.js";
import { InMemoryProgressionEventRepository } from "../src/repositories/progression-event-repository.js";

const USER_A = "11111111-1111-1111-1111-111111111111";
const EXERCISE_STALLED = "22222222-2222-2222-2222-222222222222";
const EXERCISE_ABANDONED = "33333333-3333-3333-3333-333333333333";
const WORKOUT_ID = "44444444-4444-4444-4444-444444444444";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-30T00:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

describe("ExerciseHistoryCacheRepository.recordSessionLogged", () => {
  it("mantiene first_logged_at al piu' vecchio anche se una sessione retrodatata arriva dopo", async () => {
    const cache = new InMemoryExerciseHistoryCacheRepository();

    await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s1",
      performedAt: daysAgo(25),
      workoutId: WORKOUT_ID,
      sets: [],
    });
    await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s0",
      performedAt: daysAgo(35), // retrodatata, arrivata dopo
      workoutId: WORKOUT_ID,
      sets: [],
    });

    const stalled = await cache.getStalledExercise(USER_A, NOW);
    // Nessuna progressione mai: l'ancora e' first_logged_at, che deve
    // riflettere la sessione piu' vecchia (35gg fa), non la prima arrivata (25gg fa).
    expect(stalled?.daysSinceLastProgression).toBe(35);
  });

  it("non duplica un'entry se lo stesso sessionId arriva due volte (ridelivery)", async () => {
    const cache = new InMemoryExerciseHistoryCacheRepository();

    const first = await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s1",
      performedAt: daysAgo(1),
      workoutId: WORKOUT_ID,
      sets: [],
    });
    const second = await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s1",
      performedAt: daysAgo(1),
      workoutId: WORKOUT_ID,
      sets: [],
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});

describe("ExerciseHistoryCacheRepository.recordSessionDeleted", () => {
  it("rimuove l'entry corrispondente dalla finestra", async () => {
    const cache = new InMemoryExerciseHistoryCacheRepository();
    await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s1",
      performedAt: daysAgo(1),
      workoutId: WORKOUT_ID,
      sets: [],
    });

    await cache.recordSessionDeleted(USER_A, EXERCISE_STALLED, "s1");
    const remaining = await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s2",
      performedAt: daysAgo(1),
      workoutId: WORKOUT_ID,
      sets: [],
    });

    expect(remaining.map((e) => e.sessionId)).toEqual(["s2"]);
  });
});

describe("ExerciseHistoryCacheRepository.getStalledExercise", () => {
  it("torna null se nessun esercizio supera la soglia di stallo", async () => {
    const cache = new InMemoryExerciseHistoryCacheRepository();
    await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "s1",
      performedAt: daysAgo(5),
      workoutId: WORKOUT_ID,
      sets: [],
    });

    expect(await cache.getStalledExercise(USER_A, NOW)).toBeNull();
  });

  it("segnala l'esercizio col gap maggiore, usando l'ultima progressione come ancora se presente", async () => {
    const progressionEvents = new InMemoryProgressionEventRepository();
    const cache = new InMemoryExerciseHistoryCacheRepository(progressionEvents);

    // Esercizio A: loggato di recente, ultima progressione 25gg fa -> in stallo.
    await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "sA",
      performedAt: daysAgo(2),
      workoutId: WORKOUT_ID,
      sets: [],
    });
    await progressionEvents.create({
      userId: USER_A,
      exerciseId: EXERCISE_STALLED,
      exerciseName: "Panca piana",
      triggeringSessionId: "sOld",
      suggestionType: "increase_weight",
      previousValue: 80,
      suggestedValue: 82.5,
      reason: "test",
    });
    // Forza created_at a 25 giorni fa (InMemory lo imposta a "adesso" alla creazione).
    const events = await progressionEvents.listByOwner(USER_A);
    events[0].createdAt = daysAgo(25);

    const stalled = await cache.getStalledExercise(USER_A, NOW);
    expect(stalled).toMatchObject({
      exerciseId: EXERCISE_STALLED,
      exerciseName: "Panca piana",
      daysSinceLastProgression: 25,
    });
  });

  it("esclude un esercizio il cui log piu' recente e' oltre la finestra di allenamento attivo (abbandonato)", async () => {
    const cache = new InMemoryExerciseHistoryCacheRepository();

    // Abbandonato: ultimo log 90 giorni fa, nessuna progressione mai ->
    // sarebbe il gap massimo in assoluto, ma va escluso dal fix.
    await cache.recordSessionLogged(USER_A, EXERCISE_ABANDONED, "Esercizio abbandonato", {
      sessionId: "sAbandoned",
      performedAt: daysAgo(90),
      workoutId: WORKOUT_ID,
      sets: [],
    });
    // Ancora attivo (cadenza non settimanale): ultimo log 30 giorni fa,
    // nessuna progressione da 25 giorni.
    await cache.recordSessionLogged(USER_A, EXERCISE_STALLED, "Panca piana", {
      sessionId: "sActive",
      performedAt: daysAgo(30),
      workoutId: WORKOUT_ID,
      sets: [],
    });

    const stalled = await cache.getStalledExercise(USER_A, NOW);
    expect(stalled?.exerciseId).toBe(EXERCISE_STALLED);
  });
});

import { describe, it, expect } from "vitest";
import { createLogger } from "@gym-tracker/shared";
import {
  handleUserDeleted,
  type UserDeletedConsumerDeps,
} from "../src/events/user-deleted-consumer.js";
import { InMemoryProgressionEventRepository } from "../src/repositories/progression-event-repository.js";
import { InMemoryProgressionPreferencesRepository } from "../src/repositories/progression-preferences-repository.js";
import { InMemoryProgressionDefaultsRepository } from "../src/repositories/progression-defaults-repository.js";
import { InMemoryExerciseHistoryCacheRepository } from "../src/repositories/exercise-history-cache-repository.js";
import { InMemoryProcessedSessionsRepository } from "../src/repositories/processed-sessions-repository.js";

const USER_A = "11111111-1111-1111-a111-111111111111";
const USER_B = "22222222-2222-2222-a222-222222222222";
const EXERCISE_ID = "33333333-3333-3333-a333-333333333333";

function buildDeps(): UserDeletedConsumerDeps & {
  progressionEvents: InMemoryProgressionEventRepository;
  progressionPreferences: InMemoryProgressionPreferencesRepository;
  progressionDefaults: InMemoryProgressionDefaultsRepository;
  exerciseHistoryCache: InMemoryExerciseHistoryCacheRepository;
  processedSessions: InMemoryProcessedSessionsRepository;
} {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("progress-service", { level: "silent" }),
    progressionEvents: new InMemoryProgressionEventRepository(),
    progressionPreferences: new InMemoryProgressionPreferencesRepository(),
    progressionDefaults: new InMemoryProgressionDefaultsRepository(),
    exerciseHistoryCache: new InMemoryExerciseHistoryCacheRepository(),
    processedSessions: new InMemoryProcessedSessionsRepository(),
  };
}

async function seedUser(deps: ReturnType<typeof buildDeps>, userId: string): Promise<void> {
  await deps.progressionEvents.create({
    userId,
    exerciseId: EXERCISE_ID,
    exerciseName: "Panca piana",
    triggeringSessionId: "s1",
    suggestionType: "increase_weight",
    previousValue: 60,
    suggestedValue: 62.5,
    reason: "test",
  });
  await deps.progressionPreferences.upsert(userId, {
    requiredConsecutiveSessions: 3,
    groupingScope: "exercise",
  });
  await deps.progressionDefaults.upsertMany(userId, [
    { exerciseId: EXERCISE_ID, suggestionType: "increase_weight", value: 62.5 },
  ]);
  await deps.exerciseHistoryCache.recordSessionLogged(userId, EXERCISE_ID, "Panca piana", {
    sessionId: "s1",
    performedAt: "2026-01-01T10:00:00.000Z",
    workoutId: "w1",
    sets: [],
  });
  await deps.processedSessions.markProcessed("s1", userId, true);
}

describe("handleUserDeleted", () => {
  it("cancella tutti i dati di progress-service dell'utente", async () => {
    const deps = buildDeps();
    await seedUser(deps, USER_A);

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.progressionEvents.listByOwner(USER_A)).toHaveLength(0);
    expect(await deps.progressionPreferences.find(USER_A)).toEqual({
      requiredConsecutiveSessions: 2,
      groupingScope: "workout",
    });
    expect(await deps.progressionDefaults.listByOwner(USER_A)).toHaveLength(0);
    expect(await deps.exerciseHistoryCache.getStalledExercise(USER_A)).toBeNull();
    expect(await deps.processedSessions.findStatus("s1")).toBeNull();
  });

  it("non tocca i dati di un altro utente", async () => {
    const deps = buildDeps();
    await seedUser(deps, USER_B);

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.progressionEvents.listByOwner(USER_B)).toHaveLength(1);
    expect(await deps.progressionDefaults.listByOwner(USER_B)).toHaveLength(1);
    expect(await deps.processedSessions.findStatus("s1")).toEqual({
      userId: USER_B,
      hadSuggestions: true,
    });
  });
});

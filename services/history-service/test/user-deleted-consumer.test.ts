import { describe, it, expect } from "vitest";
import { createLogger } from "@gym-tracker/shared";
import {
  handleUserDeleted,
  type UserDeletedConsumerDeps,
} from "../src/events/user-deleted-consumer.js";
import { InMemorySessionRepository } from "../src/repositories/session-repository.js";
import { InMemoryMeasurementEntryRepository } from "../src/repositories/measurement-entry-repository.js";

const USER_A = "11111111-1111-1111-a111-111111111111";
const USER_B = "22222222-2222-2222-a222-222222222222";

function buildDeps(): UserDeletedConsumerDeps & {
  sessions: InMemorySessionRepository;
  measurementEntries: InMemoryMeasurementEntryRepository;
} {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("history-service", { level: "silent" }),
    sessions: new InMemorySessionRepository(),
    measurementEntries: new InMemoryMeasurementEntryRepository(),
  };
}

describe("handleUserDeleted", () => {
  it("cancella tutte le sessioni e le misure storicizzate dell'utente", async () => {
    const deps = buildDeps();
    await deps.sessions.create(USER_A, {
      workoutId: "w1",
      workoutName: "Scheda A",
      workoutNotes: null,
      performedAt: "2026-01-01T10:00:00.000Z",
      notes: null,
      exercises: [],
    });
    await deps.measurementEntries.upsert(USER_A, "2026-01-01", {
      weightKg: 80,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.sessions.listByOwner(USER_A)).toHaveLength(0);
    expect(await deps.measurementEntries.listByOwner(USER_A)).toHaveLength(0);
  });

  it("non tocca le sessioni/misure di un altro utente", async () => {
    const deps = buildDeps();
    await deps.sessions.create(USER_B, {
      workoutId: "w2",
      workoutName: "Scheda B",
      workoutNotes: null,
      performedAt: "2026-01-01T10:00:00.000Z",
      notes: null,
      exercises: [],
    });
    await deps.measurementEntries.upsert(USER_B, "2026-01-01", {
      weightKg: 70,
      chestCm: null,
      armCm: null,
      waistCm: null,
      legCm: null,
    });

    await handleUserDeleted({ userId: USER_A }, deps);

    expect(await deps.sessions.listByOwner(USER_B)).toHaveLength(1);
    expect(await deps.measurementEntries.listByOwner(USER_B)).toHaveLength(1);
  });
});

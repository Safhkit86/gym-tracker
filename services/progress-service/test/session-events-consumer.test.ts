import { describe, it, expect } from "vitest";
import {
  handleSessionLogged,
  handleSessionDeleted,
  type SessionEventsConsumerDeps,
} from "../src/events/session-events-consumer.js";
import { InMemoryProgressionEventRepository } from "../src/repositories/progression-event-repository.js";
import { InMemoryProgressionPreferencesRepository } from "../src/repositories/progression-preferences-repository.js";
import { InMemoryProgressionDefaultsRepository } from "../src/repositories/progression-defaults-repository.js";
import { InMemoryExerciseHistoryCacheRepository } from "../src/repositories/exercise-history-cache-repository.js";
import { InMemoryProcessedSessionsRepository } from "../src/repositories/processed-sessions-repository.js";
import { InMemoryPersonalRecordRepository } from "../src/repositories/personal-record-repository.js";
import { InMemoryProgressionEventPublisher } from "../src/events/publisher.js";
import { createLogger } from "@gym-tracker/shared";
import type { SessionLoggedEvent } from "@gym-tracker/shared";

const USER_A = "11111111-1111-1111-a111-111111111111";
const WORKOUT_ID = "22222222-2222-2222-a222-222222222222";
const EXERCISE_ID = "33333333-3333-3333-a333-333333333333";

function buildDeps(): SessionEventsConsumerDeps {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("progress-service", { level: "silent" }),
    progressionEvents: new InMemoryProgressionEventRepository(),
    progressionPreferences: new InMemoryProgressionPreferencesRepository(),
    progressionDefaults: new InMemoryProgressionDefaultsRepository(),
    exerciseHistoryCache: new InMemoryExerciseHistoryCacheRepository(),
    processedSessions: new InMemoryProcessedSessionsRepository(),
    personalRecords: new InMemoryPersonalRecordRepository(),
    publisher: new InMemoryProgressionEventPublisher(),
  };
}

function sessionLoggedEvent(overrides: {
  sessionId: string;
  performedAt: string;
  actualReps?: number;
  actualWeight?: number | null;
}): SessionLoggedEvent {
  return {
    sessionId: overrides.sessionId,
    userId: USER_A,
    workoutId: WORKOUT_ID,
    performedAt: overrides.performedAt,
    exercises: [
      {
        exerciseId: EXERCISE_ID,
        exerciseName: "Panca piana",
        progressionIncrement: 2.5,
        sets: [
          {
            setNumber: 1,
            targetMinReps: 10,
            targetMaxReps: null,
            actualReps: overrides.actualReps ?? 10,
            actualWeight: overrides.actualWeight === undefined ? 80 : overrides.actualWeight,
          },
        ],
      },
    ],
  };
}

describe("handleSessionLogged", () => {
  it("non genera suggerimenti al primo log e marca la sessione come processata", async () => {
    const deps = buildDeps();

    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s1", performedAt: "2026-07-01T10:00:00.000Z" }),
      deps
    );

    expect(await deps.progressionEvents.listByOwner(USER_A)).toHaveLength(0);
    expect(await deps.processedSessions.findStatus("s1")).toEqual({
      userId: USER_A,
      hadSuggestions: false,
    });
  });

  it("genera un suggerimento dopo 2 sessioni consecutive al target, e lo pubblica", async () => {
    const deps = buildDeps();

    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s1", performedAt: "2026-07-01T10:00:00.000Z" }),
      deps
    );
    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s2", performedAt: "2026-07-08T10:00:00.000Z" }),
      deps
    );

    const events = await deps.progressionEvents.listByOwner(USER_A);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ suggestionType: "increase_weight", suggestedValue: 82.5 });

    const publisher = deps.publisher as InMemoryProgressionEventPublisher;
    expect(publisher.published).toHaveLength(1);

    expect(await deps.processedSessions.findStatus("s2")).toEqual({
      userId: USER_A,
      hadSuggestions: true,
    });
  });

  it("e' idempotente: una ridelivery della stessa sessione non rivaluta ne' duplica", async () => {
    const deps = buildDeps();

    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s1", performedAt: "2026-07-01T10:00:00.000Z" }),
      deps
    );
    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s2", performedAt: "2026-07-08T10:00:00.000Z" }),
      deps
    );
    // Ridelivery di s2 (gia' processata): non deve ricreare un secondo evento.
    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s2", performedAt: "2026-07-08T10:00:00.000Z" }),
      deps
    );

    expect(await deps.progressionEvents.listByOwner(USER_A)).toHaveLength(1);
  });
});

describe("handleSessionLogged — rilevamento PR", () => {
  it("non genera un PR al primo log (nessun record da battere)", async () => {
    const deps = buildDeps();

    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s1", performedAt: "2026-07-01T10:00:00.000Z" }),
      deps
    );

    const events = await deps.progressionEvents.listByOwner(USER_A);
    expect(events.filter((e) => e.suggestionType === "personal_record_weight")).toHaveLength(0);
  });

  it("genera e pubblica un personal_record_weight quando un set batte il record storico", async () => {
    const deps = buildDeps();
    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s1",
        performedAt: "2026-07-01T10:00:00.000Z",
        actualWeight: 80,
      }),
      deps
    );

    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s2",
        performedAt: "2026-07-08T10:00:00.000Z",
        actualWeight: 85,
      }),
      deps
    );

    const events = await deps.progressionEvents.listByOwner(USER_A);
    const prEvents = events.filter((e) => e.suggestionType === "personal_record_weight");
    expect(prEvents).toHaveLength(1);
    expect(prEvents[0]).toMatchObject({
      previousValue: 80,
      suggestedValue: 85,
      triggeringSessionId: "s2",
    });

    const publisher = deps.publisher as InMemoryProgressionEventPublisher;
    expect(publisher.published.some((p) => p.suggestionType === "personal_record_weight")).toBe(
      true
    );
  });

  it("non genera un PR se il peso non supera il record precedente", async () => {
    const deps = buildDeps();
    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s1",
        performedAt: "2026-07-01T10:00:00.000Z",
        actualWeight: 80,
      }),
      deps
    );

    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s2",
        performedAt: "2026-07-08T10:00:00.000Z",
        actualWeight: 75,
      }),
      deps
    );

    const events = await deps.progressionEvents.listByOwner(USER_A);
    expect(events.filter((e) => e.suggestionType === "personal_record_weight")).toHaveLength(0);
  });

  it("e' idempotente rispetto a processedSessions: una ridelivery non duplica il PR", async () => {
    const deps = buildDeps();
    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s1",
        performedAt: "2026-07-01T10:00:00.000Z",
        actualWeight: 80,
      }),
      deps
    );
    const second = sessionLoggedEvent({
      sessionId: "s2",
      performedAt: "2026-07-08T10:00:00.000Z",
      actualWeight: 85,
    });
    await handleSessionLogged(second, deps);
    await handleSessionLogged(second, deps);

    const events = await deps.progressionEvents.listByOwner(USER_A);
    expect(events.filter((e) => e.suggestionType === "personal_record_weight")).toHaveLength(1);
  });
});

describe("handleSessionDeleted", () => {
  it("cancella i progression_events collegati e rimuove l'entry dalla cache", async () => {
    const deps = buildDeps();

    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s1", performedAt: "2026-07-01T10:00:00.000Z" }),
      deps
    );
    await handleSessionLogged(
      sessionLoggedEvent({ sessionId: "s2", performedAt: "2026-07-08T10:00:00.000Z" }),
      deps
    );
    expect(await deps.progressionEvents.listByOwner(USER_A)).toHaveLength(1);

    await handleSessionDeleted(
      { sessionId: "s2", userId: USER_A, exerciseIds: [EXERCISE_ID] },
      deps
    );

    expect(await deps.progressionEvents.listByOwner(USER_A)).toHaveLength(0);
  });

  it("cancella anche un progression_event di tipo PR triggerato dalla sessione cancellata", async () => {
    const deps = buildDeps();
    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s1",
        performedAt: "2026-07-01T10:00:00.000Z",
        actualWeight: 80,
      }),
      deps
    );
    await handleSessionLogged(
      sessionLoggedEvent({
        sessionId: "s2",
        performedAt: "2026-07-08T10:00:00.000Z",
        actualWeight: 85,
      }),
      deps
    );
    expect(
      (await deps.progressionEvents.listByOwner(USER_A)).filter(
        (e) => e.suggestionType === "personal_record_weight"
      )
    ).toHaveLength(1);

    await handleSessionDeleted(
      { sessionId: "s2", userId: USER_A, exerciseIds: [EXERCISE_ID] },
      deps
    );

    expect(
      (await deps.progressionEvents.listByOwner(USER_A)).filter(
        (e) => e.suggestionType === "personal_record_weight"
      )
    ).toHaveLength(0);
    // Il record "permanente" (85kg) non viene retrocesso: semplificazione
    // accettata, vedi commento in handleSessionDeleted.
    expect(await deps.personalRecords.findByUserAndExercise(USER_A, EXERCISE_ID)).toMatchObject({
      bestWeight: 85,
    });
  });
});

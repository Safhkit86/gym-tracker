import { describe, it, expect } from "vitest";
import { createLogger } from "@gym-tracker/shared";
import type { MeasurementSaveRequestedEvent } from "@gym-tracker/shared";
import {
  handleMeasurementSaveRequested,
  type MeasurementEventsConsumerDeps,
} from "../src/events/measurement-events-consumer.js";
import { InMemoryMeasurementEntryRepository } from "../src/repositories/measurement-entry-repository.js";
import { InMemoryMeasurementEventPublisher } from "../src/events/measurement-events-publisher.js";

const USER_A = "11111111-1111-1111-1111-111111111111";

function buildDeps(): MeasurementEventsConsumerDeps & {
  measurementEntries: InMemoryMeasurementEntryRepository;
  publisher: InMemoryMeasurementEventPublisher;
} {
  return {
    connectionUrl: "amqp://unused",
    logger: createLogger("history-service", { level: "silent" }),
    measurementEntries: new InMemoryMeasurementEntryRepository(),
    publisher: new InMemoryMeasurementEventPublisher(),
  };
}

function event(
  overrides: Partial<MeasurementSaveRequestedEvent> = {}
): MeasurementSaveRequestedEvent {
  return {
    userId: USER_A,
    measuredOn: "2026-07-01",
    weightKg: 80,
    chestCm: null,
    armCm: null,
    waistCm: null,
    legCm: null,
    ...overrides,
  };
}

describe("handleMeasurementSaveRequested", () => {
  it("fa l'upsert dell'entry e pubblica measurement-recorded", async () => {
    const deps = buildDeps();

    await handleMeasurementSaveRequested(event(), deps);

    const list = await deps.measurementEntries.listByOwner(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ measuredOn: "2026-07-01", weightKg: 80 });

    expect(deps.publisher.published).toHaveLength(1);
    expect(deps.publisher.published[0]).toMatchObject({ userId: USER_A, weightKg: 80 });
  });

  it("aggiorna (non duplica) l'entry se arriva di nuovo la stessa data", async () => {
    const deps = buildDeps();

    await handleMeasurementSaveRequested(event({ weightKg: 80 }), deps);
    await handleMeasurementSaveRequested(event({ weightKg: 79.5 }), deps);

    const list = await deps.measurementEntries.listByOwner(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0].weightKg).toBe(79.5);
  });
});

import { describe, it, expect } from "vitest";
import {
  countRetryAttempts,
  nextBackoffDelayMs,
  queueNamesFor,
  DEFAULT_BACKOFF_DELAYS_MS,
} from "../src/queue-reliability.js";

describe("queueNamesFor", () => {
  it("deriva i nomi delle code di retry e dead-letter da quello di lavoro", () => {
    expect(queueNamesFor("progression-events")).toEqual({
      work: "progression-events",
      retry: "progression-events.retry",
      deadLetter: "progression-events.dead-letter",
    });
  });
});

describe("countRetryAttempts", () => {
  it("torna 0 se non c'e' nessun header x-death", () => {
    expect(countRetryAttempts(undefined, "progression-events.retry")).toBe(0);
  });

  it("torna 0 se x-death non contiene la coda di retry", () => {
    const headers = { "x-death": [{ queue: "altra-coda", count: 3 }] };
    expect(countRetryAttempts(headers, "progression-events.retry")).toBe(0);
  });

  it("legge il count dell'entry corrispondente alla coda di retry", () => {
    const headers = {
      "x-death": [
        { queue: "altra-coda", count: 1 },
        { queue: "progression-events.retry", count: 3 },
      ],
    };
    expect(countRetryAttempts(headers, "progression-events.retry")).toBe(3);
  });
});

describe("nextBackoffDelayMs", () => {
  it("torna il primo ritardo al primo tentativo", () => {
    expect(nextBackoffDelayMs(0, DEFAULT_BACKOFF_DELAYS_MS)).toBe(10_000);
  });

  it("torna il ritardo successivo ad ogni tentativo", () => {
    expect(nextBackoffDelayMs(1, DEFAULT_BACKOFF_DELAYS_MS)).toBe(30_000);
    expect(nextBackoffDelayMs(4, DEFAULT_BACKOFF_DELAYS_MS)).toBe(900_000);
  });

  it("torna null quando i tentativi di backoff sono esauriti", () => {
    expect(nextBackoffDelayMs(5, DEFAULT_BACKOFF_DELAYS_MS)).toBeNull();
    expect(nextBackoffDelayMs(10, DEFAULT_BACKOFF_DELAYS_MS)).toBeNull();
  });
});

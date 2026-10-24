import { describe, it, expect } from "vitest";
import type { Notification } from "@gym-tracker/shared";
import {
  formatSuggestionDelta,
  isPersonalRecord,
  toOverride,
} from "../notifications/suggestion-format";

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    exerciseId: "e1",
    exerciseName: "Panca piana",
    suggestionType: "increase_weight",
    previousValue: 80,
    suggestedValue: 82.5,
    reason: "test",
    triggeringSessionId: "s1",
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isPersonalRecord", () => {
  it("e' false per i suggerimenti di progressione (su cui si puo' agire)", () => {
    expect(isPersonalRecord(notification({ suggestionType: "increase_weight" }))).toBe(false);
    expect(isPersonalRecord(notification({ suggestionType: "increase_reps" }))).toBe(false);
  });

  it("e' true per un nuovo massimale", () => {
    expect(isPersonalRecord(notification({ suggestionType: "personal_record_weight" }))).toBe(true);
    expect(isPersonalRecord(notification({ suggestionType: "personal_record_reps" }))).toBe(true);
  });
});

describe("toOverride", () => {
  it("costruisce l'override per un suggerimento di progressione", () => {
    expect(toOverride(notification())).toEqual({
      exerciseId: "e1",
      suggestionType: "increase_weight",
      value: 82.5,
    });
  });

  it("torna null per un nuovo massimale (niente da accettare)", () => {
    expect(
      toOverride(notification({ suggestionType: "personal_record_weight", suggestedValue: 85 }))
    ).toBeNull();
  });

  it("torna null se manca il valore suggerito", () => {
    expect(toOverride(notification({ suggestedValue: null }))).toBeNull();
  });
});

describe("formatSuggestionDelta", () => {
  it("formatta in kg sia increase_weight che personal_record_weight", () => {
    expect(formatSuggestionDelta(notification({ suggestionType: "increase_weight" }))).toBe(
      "80kg → 82.5kg"
    );
    expect(
      formatSuggestionDelta(
        notification({
          suggestionType: "personal_record_weight",
          previousValue: 80,
          suggestedValue: 85,
        })
      )
    ).toBe("80kg → 85kg");
  });

  it("formatta in ripetizioni sia increase_reps che personal_record_reps", () => {
    expect(
      formatSuggestionDelta(
        notification({ suggestionType: "increase_reps", previousValue: 10, suggestedValue: 11 })
      )
    ).toBe("10 → 11 rip.");
    expect(
      formatSuggestionDelta(
        notification({
          suggestionType: "personal_record_reps",
          previousValue: 10,
          suggestedValue: 13,
        })
      )
    ).toBe("10 → 13 rip.");
  });

  it("torna stringa vuota se manca un valore", () => {
    expect(formatSuggestionDelta(notification({ previousValue: null }))).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import {
  evaluatePersonalRecords,
  formatPersonalRecordReason,
  EMPTY_PERSONAL_RECORD_STATE,
} from "../src/domain/personal-record-detector.js";

describe("evaluatePersonalRecords", () => {
  it("al primo log di un esercizio pesato inizializza lo stato senza notificare", () => {
    const result = evaluatePersonalRecords(EMPTY_PERSONAL_RECORD_STATE, [
      { actualWeight: 80, actualReps: 8 },
    ]);

    expect(result.newRecords).toHaveLength(0);
    expect(result.state).toEqual({
      bestWeight: 80,
      bestWeightReps: 8,
      bestBodyweightReps: null,
    });
  });

  it("al primo log a corpo libero inizializza senza notificare", () => {
    const result = evaluatePersonalRecords(EMPTY_PERSONAL_RECORD_STATE, [
      { actualWeight: null, actualReps: 12 },
    ]);

    expect(result.newRecords).toHaveLength(0);
    expect(result.state.bestBodyweightReps).toBe(12);
  });

  it("segnala un nuovo massimale di peso quando un set supera il record precedente", () => {
    const current = { bestWeight: 80, bestWeightReps: 8, bestBodyweightReps: null };

    const result = evaluatePersonalRecords(current, [{ actualWeight: 85, actualReps: 6 }]);

    expect(result.newRecords).toEqual([{ kind: "weight", previousValue: 80, newValue: 85 }]);
    expect(result.state).toEqual({
      bestWeight: 85,
      bestWeightReps: 6,
      bestBodyweightReps: null,
    });
  });

  it("non segnala nulla se il peso non supera il record (anche a parita')", () => {
    const current = { bestWeight: 80, bestWeightReps: 8, bestBodyweightReps: null };

    const same = evaluatePersonalRecords(current, [{ actualWeight: 80, actualReps: 10 }]);
    const lower = evaluatePersonalRecords(current, [{ actualWeight: 75, actualReps: 10 }]);

    expect(same.newRecords).toHaveLength(0);
    expect(lower.newRecords).toHaveLength(0);
  });

  it("segnala un nuovo massimale di ripetizioni a corpo libero", () => {
    const current = { bestWeight: null, bestWeightReps: null, bestBodyweightReps: 10 };

    const result = evaluatePersonalRecords(current, [{ actualWeight: null, actualReps: 13 }]);

    expect(result.newRecords).toEqual([
      { kind: "bodyweight_reps", previousValue: 10, newValue: 13 },
    ]);
  });

  it("con piu' set nella stessa sessione segnala un solo evento per tipo, il migliore", () => {
    const current = { bestWeight: 80, bestWeightReps: 8, bestBodyweightReps: null };

    const result = evaluatePersonalRecords(current, [
      { actualWeight: 82, actualReps: 6 },
      { actualWeight: 85, actualReps: 4 },
      { actualWeight: 83, actualReps: 5 },
    ]);

    expect(result.newRecords).toEqual([{ kind: "weight", previousValue: 80, newValue: 85 }]);
    expect(result.state.bestWeight).toBe(85);
  });

  it("peso e ripetizioni a corpo libero sono indipendenti: possono scattare entrambi nella stessa sessione", () => {
    const current = { bestWeight: 80, bestWeightReps: 8, bestBodyweightReps: 10 };

    const result = evaluatePersonalRecords(current, [
      { actualWeight: 85, actualReps: 6 },
      { actualWeight: null, actualReps: 15 },
    ]);

    expect(result.newRecords).toEqual([
      { kind: "weight", previousValue: 80, newValue: 85 },
      { kind: "bodyweight_reps", previousValue: 10, newValue: 15 },
    ]);
  });
});

describe("formatPersonalRecordReason", () => {
  it("include il valore precedente quando presente", () => {
    expect(formatPersonalRecordReason({ kind: "weight", previousValue: 80, newValue: 85 })).toBe(
      "Nuovo massimale: 85 kg (precedente: 80 kg)"
    );
  });

  it("formatta le ripetizioni a corpo libero senza kg", () => {
    expect(
      formatPersonalRecordReason({ kind: "bodyweight_reps", previousValue: 10, newValue: 13 })
    ).toBe("Nuovo massimale: 13 rip. (precedente: 10 rip.)");
  });

  it("omette 'precedente' se non c'era un record prima (non dovrebbe succedere in pratica: evaluatePersonalRecords non genera un NewPersonalRecord al primo log)", () => {
    expect(formatPersonalRecordReason({ kind: "weight", previousValue: null, newValue: 85 })).toBe(
      "Nuovo massimale: 85 kg"
    );
  });
});

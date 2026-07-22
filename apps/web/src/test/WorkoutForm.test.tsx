import { describe, it, expect } from "vitest";
import type { WorkoutDetail } from "@gym-tracker/shared";
import { workoutDetailToFormValues } from "../components/workout-form-utils";

function workout(overrides: Partial<WorkoutDetail> = {}): WorkoutDetail {
  return {
    id: "w1",
    name: "Push day",
    notes: null,
    exercises: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("workoutDetailToFormValues", () => {
  it("converte i campi numerici null in stringa vuota", () => {
    const result = workoutDetailToFormValues(
      workout({
        exercises: [
          {
            id: "we1",
            exerciseId: "e1",
            exerciseName: "Panca piana",
            position: 1,
            notes: null,
            restSeconds: null,
            progressionIncrement: null,
            sets: [
              {
                id: "s1",
                setNumber: 1,
                targetMinReps: 10,
                targetMaxReps: null,
                targetWeight: null,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
            ],
          },
        ],
      })
    );

    expect(result.exercises[0].restSeconds).toBe("");
    expect(result.exercises[0].progressionIncrement).toBe("");
    expect(result.exercises[0].sets[0].targetWeight).toBe("");
    expect(result.exercises[0].sets[0].restMinSeconds).toBe("");
    expect(result.exercises[0].sets[0].targetMinReps).toBe("10");
  });

  it("riordina esercizi e set quando il server li restituisce fuori ordine", () => {
    const result = workoutDetailToFormValues(
      workout({
        exercises: [
          {
            id: "we2",
            exerciseId: "e2",
            exerciseName: "Squat",
            position: 2,
            notes: null,
            restSeconds: null,
            progressionIncrement: null,
            sets: [
              {
                id: "s2b",
                setNumber: 2,
                targetMinReps: 8,
                targetMaxReps: null,
                targetWeight: 60,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
              {
                id: "s2a",
                setNumber: 1,
                targetMinReps: 10,
                targetMaxReps: null,
                targetWeight: 50,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
            ],
          },
          {
            id: "we1",
            exerciseId: "e1",
            exerciseName: "Panca piana",
            position: 1,
            notes: null,
            restSeconds: null,
            progressionIncrement: null,
            sets: [
              {
                id: "s1",
                setNumber: 1,
                targetMinReps: 10,
                targetMaxReps: null,
                targetWeight: 40,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
            ],
          },
        ],
      })
    );

    expect(result.exercises.map((e) => e.exerciseId)).toEqual(["e1", "e2"]);
    expect(result.exercises[1].sets.map((s) => s.targetWeight)).toEqual(["50", "60"]);
  });

  it("converte note null della scheda in stringa vuota", () => {
    const result = workoutDetailToFormValues(workout({ notes: null }));
    expect(result.notes).toBe("");
  });

  it("converte targetMaxReps null in stringa vuota e un valore impostato nella sua stringa", () => {
    const result = workoutDetailToFormValues(
      workout({
        exercises: [
          {
            id: "we1",
            exerciseId: "e1",
            exerciseName: "Panca piana",
            position: 1,
            notes: null,
            restSeconds: null,
            progressionIncrement: null,
            sets: [
              {
                id: "s1",
                setNumber: 1,
                targetMinReps: 8,
                targetMaxReps: 12,
                targetWeight: null,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
              {
                id: "s2",
                setNumber: 2,
                targetMinReps: 10,
                targetMaxReps: null,
                targetWeight: null,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
            ],
          },
        ],
      })
    );

    expect(result.exercises[0].sets[0].targetMaxReps).toBe("12");
    expect(result.exercises[0].sets[1].targetMaxReps).toBe("");
  });

  it("converte restMinSeconds/restMaxSeconds null in stringa vuota e i valori impostati nella loro stringa", () => {
    const result = workoutDetailToFormValues(
      workout({
        exercises: [
          {
            id: "we1",
            exerciseId: "e1",
            exerciseName: "Panca piana",
            position: 1,
            notes: null,
            restSeconds: null,
            progressionIncrement: null,
            sets: [
              {
                id: "s1",
                setNumber: 1,
                targetMinReps: 8,
                targetMaxReps: null,
                targetWeight: null,
                restMinSeconds: 60,
                restMaxSeconds: 90,
                isMaxEffort: false,
              },
              {
                id: "s2",
                setNumber: 2,
                targetMinReps: 8,
                targetMaxReps: null,
                targetWeight: null,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: false,
              },
            ],
          },
        ],
      })
    );

    expect(result.exercises[0].sets[0].restMinSeconds).toBe("60");
    expect(result.exercises[0].sets[0].restMaxSeconds).toBe("90");
    expect(result.exercises[0].sets[1].restMinSeconds).toBe("");
    expect(result.exercises[0].sets[1].restMaxSeconds).toBe("");
  });

  it("riporta isMaxEffort e targetMinReps null per un set a sforzo massimo (AMRAP)", () => {
    const result = workoutDetailToFormValues(
      workout({
        exercises: [
          {
            id: "we1",
            exerciseId: "e1",
            exerciseName: "Trazioni alla sbarra",
            position: 1,
            notes: null,
            restSeconds: null,
            progressionIncrement: null,
            sets: [
              {
                id: "s1",
                setNumber: 1,
                targetMinReps: null,
                targetMaxReps: null,
                targetWeight: null,
                restMinSeconds: null,
                restMaxSeconds: null,
                isMaxEffort: true,
              },
            ],
          },
        ],
      })
    );

    expect(result.exercises[0].sets[0].isMaxEffort).toBe(true);
    expect(result.exercises[0].sets[0].targetMinReps).toBe("");
  });
});

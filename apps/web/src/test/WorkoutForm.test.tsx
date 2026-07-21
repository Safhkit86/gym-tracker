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
              { id: "s1", setNumber: 1, targetReps: 10, targetWeight: null, restSeconds: null },
            ],
          },
        ],
      })
    );

    expect(result.exercises[0].restSeconds).toBe("");
    expect(result.exercises[0].progressionIncrement).toBe("");
    expect(result.exercises[0].sets[0].targetWeight).toBe("");
    expect(result.exercises[0].sets[0].restSeconds).toBe("");
    expect(result.exercises[0].sets[0].targetReps).toBe("10");
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
              { id: "s2b", setNumber: 2, targetReps: 8, targetWeight: 60, restSeconds: null },
              { id: "s2a", setNumber: 1, targetReps: 10, targetWeight: 50, restSeconds: null },
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
            sets: [{ id: "s1", setNumber: 1, targetReps: 10, targetWeight: 40, restSeconds: null }],
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
});

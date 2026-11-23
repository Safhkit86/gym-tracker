import { describe, it, expect } from "vitest";
import type { WorkoutDetail } from "@gym-tracker/shared";
import {
  canGroupAsSuperset,
  emptyExercise,
  emptySet,
  groupAsSuperset,
  isLastInSupersetGroup,
  supersetLabels,
  ungroupSuperset,
  type ExerciseForm,
  workoutDetailToFormValues,
} from "../components/workout-form-utils";

function exerciseWithSets(setCount: number): ExerciseForm {
  return { ...emptyExercise("e1"), sets: Array.from({ length: setCount }, () => emptySet()) };
}

function workout(overrides: Partial<WorkoutDetail> = {}): WorkoutDetail {
  return {
    id: "w1",
    name: "Push day",
    notes: null,
    allenamentoId: "a1",
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
            supersetGroupId: null,
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
            supersetGroupId: null,
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
            supersetGroupId: null,
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
            supersetGroupId: null,
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
            supersetGroupId: null,
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
            supersetGroupId: null,
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

describe("canGroupAsSuperset", () => {
  it("accetta 2+ esercizi adiacenti, non gia' raggruppati, con lo stesso numero di set", () => {
    const exercises = [exerciseWithSets(2), exerciseWithSets(2), exerciseWithSets(2)];
    expect(canGroupAsSuperset(exercises, [0, 1])).toBe(true);
    expect(canGroupAsSuperset(exercises, [0, 1, 2])).toBe(true);
  });

  it("rifiuta meno di 2 esercizi selezionati", () => {
    expect(canGroupAsSuperset([exerciseWithSets(2)], [0])).toBe(false);
  });

  it("rifiuta esercizi non adiacenti", () => {
    const exercises = [exerciseWithSets(2), exerciseWithSets(2), exerciseWithSets(2)];
    expect(canGroupAsSuperset(exercises, [0, 2])).toBe(false);
  });

  it("rifiuta un esercizio gia' in un superset", () => {
    const exercises = [{ ...exerciseWithSets(2), supersetGroupId: "g1" }, exerciseWithSets(2)];
    expect(canGroupAsSuperset(exercises, [0, 1])).toBe(false);
  });

  it("rifiuta esercizi con un numero di set diverso", () => {
    const exercises = [exerciseWithSets(2), exerciseWithSets(3)];
    expect(canGroupAsSuperset(exercises, [0, 1])).toBe(false);
  });
});

describe("groupAsSuperset / ungroupSuperset", () => {
  it("assegna lo stesso supersetGroupId a tutti gli indici selezionati", () => {
    const exercises = [exerciseWithSets(2), exerciseWithSets(2), exerciseWithSets(2)];
    const grouped = groupAsSuperset(exercises, [0, 1]);
    expect(grouped[0].supersetGroupId).not.toBeNull();
    expect(grouped[0].supersetGroupId).toBe(grouped[1].supersetGroupId);
    expect(grouped[2].supersetGroupId).toBeNull();
  });

  it("rimuove supersetGroupId da tutti i membri del gruppo", () => {
    const exercises = [exerciseWithSets(2), exerciseWithSets(2)];
    const grouped = groupAsSuperset(exercises, [0, 1]);
    const groupId = grouped[0].supersetGroupId as string;
    const ungrouped = ungroupSuperset(grouped, groupId);
    expect(ungrouped[0].supersetGroupId).toBeNull();
    expect(ungrouped[1].supersetGroupId).toBeNull();
  });
});

describe("isLastInSupersetGroup", () => {
  it("e' sempre true per un esercizio non raggruppato", () => {
    expect(isLastInSupersetGroup([exerciseWithSets(1)], 0)).toBe(true);
  });

  it("e' true solo per l'ultimo membro del gruppo nell'ordine dell'array", () => {
    const grouped = groupAsSuperset([exerciseWithSets(2), exerciseWithSets(2)], [0, 1]);
    expect(isLastInSupersetGroup(grouped, 0)).toBe(false);
    expect(isLastInSupersetGroup(grouped, 1)).toBe(true);
  });
});

describe("supersetLabels", () => {
  it("etichetta i gruppi con lettere distinte e i membri con numeri in ordine", () => {
    const groupA = groupAsSuperset([exerciseWithSets(1), exerciseWithSets(1)], [0, 1]);
    const exercises = [...groupA, exerciseWithSets(1), exerciseWithSets(1)];
    const grouped = groupAsSuperset(exercises, [2, 3]);
    const labels = supersetLabels(grouped);

    expect(labels.get(grouped[0].formId)).toBe("A1");
    expect(labels.get(grouped[1].formId)).toBe("A2");
    expect(labels.get(grouped[2].formId)).toBe("B1");
    expect(labels.get(grouped[3].formId)).toBe("B2");
  });
});

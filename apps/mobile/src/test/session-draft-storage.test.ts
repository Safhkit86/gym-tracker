import {
  loadSessionDraft,
  saveSessionDraft,
  clearSessionDraft,
} from "../utils/session-draft-storage";
import type { SessionExerciseForm } from "../utils/session-form-utils";

const exercises: SessionExerciseForm[] = [
  {
    exerciseId: "e1",
    exerciseName: "Panca piana",
    workoutExerciseId: "we1",
    progressionIncrement: 2.5,
    restSeconds: 90,
    targetRestMinSeconds: 90,
    targetRestMaxSeconds: 120,
    actualRestSeconds: "95",
    isBodyweight: false,
    actualWeight: "77.5",
    sets: [
      {
        setNumber: 1,
        targetMinReps: 10,
        targetMaxReps: null,
        isMaxEffort: false,
        actualReps: "6",
        targetRestMinSeconds: 90,
        targetRestMaxSeconds: 120,
      },
    ],
  },
];

describe("session-draft-storage", () => {
  it("nessuna bozza salvata: torna null", async () => {
    expect(await loadSessionDraft("w1")).toBeNull();
  });

  it("salva e ricarica una bozza per la stessa scheda", async () => {
    await saveSessionDraft("w1", { performedAt: "2026-08-17", exercises });

    const draft = await loadSessionDraft("w1");

    expect(draft).not.toBeNull();
    expect(draft?.performedAt).toBe("2026-08-17");
    expect(draft?.exercises).toEqual(exercises);
  });

  it("una bozza per una scheda diversa non e' visibile con un'altra chiave", async () => {
    await saveSessionDraft("w1", { performedAt: "2026-08-17", exercises });

    expect(await loadSessionDraft("w2")).toBeNull();
  });

  it("ignora una bozza troppo vecchia (oltre 24 ore)", async () => {
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000_000_000);
    await saveSessionDraft("w1", { performedAt: "2026-08-17", exercises });

    dateNowSpy.mockReturnValue(1_000_000_000_000 + 25 * 60 * 60 * 1000);
    expect(await loadSessionDraft("w1")).toBeNull();
  });

  it("clearSessionDraft svuota la bozza salvata", async () => {
    await saveSessionDraft("w1", { performedAt: "2026-08-17", exercises });
    await clearSessionDraft("w1");

    expect(await loadSessionDraft("w1")).toBeNull();
  });
});

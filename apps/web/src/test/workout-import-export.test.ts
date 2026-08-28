import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Exercise, WorkoutDetail } from "@gym-tracker/shared";
import {
  CSV_COLUMNS,
  WorkoutImportFileError,
  buildExportRows,
  importWorkoutsFromFile,
  parseWorkoutImportCsv,
  planFilename,
  singleWorkoutFilename,
  toCsvText,
  workoutDetailToPortable,
  type PortableWorkout,
} from "../components/workout-import-export";

const { listExercisesMock, createExerciseMock } = vi.hoisted(() => ({
  listExercisesMock: vi.fn(),
  createExerciseMock: vi.fn(),
}));
vi.mock("../api/exercises", () => ({
  listExercises: listExercisesMock,
  createExercise: createExerciseMock,
}));

const { createWorkoutMock } = vi.hoisted(() => ({ createWorkoutMock: vi.fn() }));
vi.mock("../api/workouts", () => ({
  createWorkout: createWorkoutMock,
}));

const TOKEN = "test-token";

const CATALOG: Exercise[] = [
  {
    id: "e1",
    userId: null,
    name: "Panca piana",
    muscleGroup: "Petto",
    description: null,
    sourceUrl: null,
  },
  {
    id: "e2",
    userId: null,
    name: "Squat",
    muscleGroup: "Gambe",
    description: null,
    sourceUrl: null,
  },
];

const WORKOUT_DETAIL: WorkoutDetail = {
  id: "w1",
  name: "Push day",
  notes: "Focus petto",
  exercises: [
    {
      id: "we1",
      exerciseId: "e1",
      exerciseName: "Panca piana",
      position: 1,
      notes: "Riscaldamento incluso",
      restSeconds: 90,
      progressionIncrement: 2.5,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: 10,
          targetWeight: 60,
          restMinSeconds: 90,
          restMaxSeconds: 120,
          isMaxEffort: false,
        },
      ],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("workoutDetailToPortable / buildExportRows / toCsvText", () => {
  it("converte una scheda in forma intermedia, referenziando l'esercizio per nome e recuperando il muscleGroup dal catalogo", () => {
    const portable = workoutDetailToPortable(WORKOUT_DETAIL, CATALOG);

    expect(portable).toEqual({
      name: "Push day",
      notes: "Focus petto",
      exercises: [
        {
          exerciseName: "Panca piana",
          muscleGroup: "Petto",
          position: 1,
          notes: "Riscaldamento incluso",
          restSeconds: 90,
          progressionIncrement: 2.5,
          sets: [
            {
              setNumber: 1,
              targetMinReps: 8,
              targetMaxReps: 10,
              targetWeight: 60,
              restMinSeconds: 90,
              restMaxSeconds: 120,
              isMaxEffort: false,
            },
          ],
        },
      ],
    });
  });

  it("costruisce una riga CSV per set, con intestazione e valori corretti", () => {
    const rows = buildExportRows([WORKOUT_DETAIL], CATALOG);

    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      "Push day",
      "Focus petto",
      "Panca piana",
      "Petto",
      "1",
      "Riscaldamento incluso",
      "90",
      "2.5",
      "1",
      "8",
      "10",
      "60",
      "90",
      "120",
      "",
    ]);
  });

  it("una riga per ogni set quando un esercizio ne ha più di uno", () => {
    const multiSet: WorkoutDetail = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          sets: [
            { ...WORKOUT_DETAIL.exercises[0].sets[0], setNumber: 1 },
            { ...WORKOUT_DETAIL.exercises[0].sets[0], id: "s2", setNumber: 2, targetWeight: 65 },
          ],
        },
      ],
    };
    const rows = buildExportRows([multiSet], CATALOG);
    expect(rows).toHaveLength(3);
    expect(rows[1][8]).toBe("1"); // colonna "set"
    expect(rows[2][8]).toBe("2");
    expect(rows[2][11]).toBe("65"); // colonna "peso_kg"
  });

  it("scrive true nella colonna sforzo_massimo e mette in quote i campi con ';'", () => {
    const amrap: WorkoutDetail = {
      ...WORKOUT_DETAIL,
      notes: "Nota; con punto e virgola",
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
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
    };
    const csv = toCsvText(buildExportRows([amrap], CATALOG));
    expect(csv).toContain('"Nota; con punto e virgola"');
    expect(csv).toContain(";true\r\n");
  });

  it("il testo CSV comincia con un BOM UTF-8 e usa ';' come separatore", () => {
    const csv = toCsvText(buildExportRows([WORKOUT_DETAIL], CATALOG));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0]).toBe("﻿" + CSV_COLUMNS.join(";"));
  });
});

describe("singleWorkoutFilename / planFilename", () => {
  it("genera un nome file .csv con uno slug del nome scheda", () => {
    expect(singleWorkoutFilename("Push Day è forte!")).toMatch(
      /^gym-tracker-push-day-e-forte-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });

  it("usa un fallback quando il nome non produce nessun carattere valido", () => {
    expect(singleWorkoutFilename("!!!")).toMatch(/^gym-tracker-scheda-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("genera un nome file fisso per il piano completo", () => {
    expect(planFilename()).toMatch(/^gym-tracker-piano-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe("parseWorkoutImportCsv", () => {
  function csv(rows: string[][]): string {
    return rows.map((r) => r.join(";")).join("\r\n");
  }

  const HEADER = [...CSV_COLUMNS];

  it("fa il round-trip di un export: le stesse righe prodotte da buildExportRows si reimportano identiche", () => {
    const exported = buildExportRows([WORKOUT_DETAIL], CATALOG);
    const reimported = parseWorkoutImportCsv(csv(exported));

    expect(reimported).toEqual([workoutDetailToPortable(WORKOUT_DETAIL, CATALOG)]);
  });

  it("raggruppa più righe con la stessa scheda+posizione nello stesso esercizio, come set diversi", () => {
    const rows = [
      HEADER,
      ["Push day", "", "Panca piana", "Petto", "1", "", "", "", "1", "8", "", "60", "", "", ""],
      ["Push day", "", "Panca piana", "Petto", "1", "", "", "", "2", "6", "", "65", "", "", ""],
    ];
    const result = parseWorkoutImportCsv(csv(rows));

    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(1);
    expect(result[0].exercises[0].sets).toHaveLength(2);
    expect(result[0].exercises[0].sets[1].targetWeight).toBe(65);
  });

  it("raggruppa righe con la stessa scheda ma posizioni diverse in esercizi distinti", () => {
    const rows = [
      HEADER,
      ["Push day", "", "Panca piana", "Petto", "1", "", "", "", "1", "8", "", "60", "", "", ""],
      ["Push day", "", "Military press", "Spalle", "2", "", "", "", "1", "8", "", "30", "", "", ""],
    ];
    const result = parseWorkoutImportCsv(csv(rows));

    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(2);
    expect(result[0].exercises.map((e) => e.exerciseName)).toEqual([
      "Panca piana",
      "Military press",
    ]);
  });

  it("tollera la virgola come separatore decimale", () => {
    const rows = [
      HEADER,
      [
        "Push day",
        "",
        "Panca piana",
        "Petto",
        "1",
        "",
        "",
        "2,5",
        "1",
        "8",
        "",
        "82,5",
        "",
        "",
        "",
      ],
    ];
    const result = parseWorkoutImportCsv(csv(rows));
    expect(result[0].exercises[0].progressionIncrement).toBe(2.5);
    expect(result[0].exercises[0].sets[0].targetWeight).toBe(82.5);
  });

  it.each(["true", "1", "si", "SÌ", "vero", "x"])("riconosce '%s' come sforzo massimo", (value) => {
    const rows = [
      HEADER,
      ["Push day", "", "Trazioni", "Schiena", "1", "", "", "", "1", "", "", "", "", "", value],
    ];
    const result = parseWorkoutImportCsv(csv(rows));
    expect(result[0].exercises[0].sets[0].isMaxEffort).toBe(true);
  });

  it("cella vuota per sforzo_massimo è false", () => {
    const rows = [
      HEADER,
      ["Push day", "", "Trazioni", "Schiena", "1", "", "", "", "1", "8", "", "", "", "", ""],
    ];
    const result = parseWorkoutImportCsv(csv(rows));
    expect(result[0].exercises[0].sets[0].isMaxEffort).toBe(false);
  });

  it("rifiuta un file vuoto", () => {
    expect(() => parseWorkoutImportCsv("")).toThrow(WorkoutImportFileError);
  });

  it("rifiuta un file senza le colonne obbligatorie", () => {
    const rows = [
      ["scheda", "note_scheda"],
      ["Push day", "note"],
    ];
    expect(() => parseWorkoutImportCsv(csv(rows))).toThrow(/mancano le colonne obbligatorie/i);
  });

  it("rifiuta un file con solo l'intestazione, senza righe di dati", () => {
    expect(() => parseWorkoutImportCsv(csv([HEADER]))).toThrow(/nessuna riga di dati/i);
  });

  it("rifiuta una riga senza nome scheda", () => {
    const rows = [
      HEADER,
      ["", "", "Panca piana", "Petto", "1", "", "", "", "1", "8", "", "60", "", "", ""],
    ];
    expect(() => parseWorkoutImportCsv(csv(rows))).toThrow(/riga 2.*scheda.*vuota/i);
  });

  it("rifiuta una riga senza nome esercizio", () => {
    const rows = [
      HEADER,
      ["Push day", "", "", "Petto", "1", "", "", "", "1", "8", "", "60", "", "", ""],
    ];
    expect(() => parseWorkoutImportCsv(csv(rows))).toThrow(/riga 2.*esercizio.*vuota/i);
  });

  it("rifiuta un numero non valido, indicando riga e colonna", () => {
    const rows = [
      HEADER,
      ["Push day", "", "Panca piana", "Petto", "1", "", "", "", "1", "otto", "", "60", "", "", ""],
    ];
    expect(() => parseWorkoutImportCsv(csv(rows))).toThrow(/riga 2.*rep_min.*otto/i);
  });

  it("gestisce campi tra virgolette con ';' e '\"' letterali al loro interno", () => {
    const raw =
      HEADER.join(";") +
      "\r\n" +
      `Push day;"Nota; con punto e virgola e ""virgolette""";Panca piana;Petto;1;;;;1;8;;60;;;`;
    const result = parseWorkoutImportCsv(raw);
    expect(result[0].notes).toBe('Nota; con punto e virgola e "virgolette"');
  });
});

describe("importWorkoutsFromFile", () => {
  beforeEach(() => {
    listExercisesMock.mockReset();
    createExerciseMock.mockReset();
    createWorkoutMock.mockReset();
  });

  function workout(overrides: Partial<PortableWorkout> = {}): PortableWorkout {
    return {
      name: "Push day",
      notes: null,
      exercises: [
        {
          exerciseName: "PANCA PIANA",
          muscleGroup: null,
          position: 1,
          notes: null,
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              setNumber: 1,
              targetMinReps: 8,
              targetMaxReps: null,
              targetWeight: 60,
              restMinSeconds: null,
              restMaxSeconds: null,
              isMaxEffort: false,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("riusa un esercizio esistente per nome (case-insensitive), senza crearne uno nuovo", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    createWorkoutMock.mockResolvedValue({ ...WORKOUT_DETAIL, id: "new-1" });

    const result = await importWorkoutsFromFile(TOKEN, [workout()]);

    expect(createExerciseMock).not.toHaveBeenCalled();
    expect(createWorkoutMock).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({
        name: "Push day",
        exercises: [expect.objectContaining({ exerciseId: "e1" })],
      })
    );
    expect(result.created).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });

  it("crea un nuovo esercizio personale quando il nome non è nel catalogo, una sola volta anche se citato in più schede", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    createExerciseMock.mockResolvedValue({
      id: "new-ex",
      userId: "u1",
      name: "Hip thrust",
      muscleGroup: "Gambe",
      description: null,
      sourceUrl: null,
    });
    createWorkoutMock.mockResolvedValue({ ...WORKOUT_DETAIL, id: "new-1" });

    const exerciseEntry = {
      exerciseName: "Hip thrust",
      muscleGroup: "Gambe",
      position: 1,
      notes: null,
      restSeconds: null,
      progressionIncrement: null,
      sets: [
        {
          setNumber: 1,
          targetMinReps: 10,
          targetMaxReps: null,
          targetWeight: 40,
          restMinSeconds: null,
          restMaxSeconds: null,
          isMaxEffort: false,
        },
      ],
    };
    const result = await importWorkoutsFromFile(TOKEN, [
      workout({ name: "Scheda A", exercises: [exerciseEntry] }),
      workout({ name: "Scheda B", exercises: [exerciseEntry] }),
    ]);

    expect(createExerciseMock).toHaveBeenCalledTimes(1);
    expect(createExerciseMock).toHaveBeenCalledWith(TOKEN, {
      name: "Hip thrust",
      muscleGroup: "Gambe",
    });
    expect(result.created).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it("un fallimento su una scheda non blocca l'import delle altre", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    createWorkoutMock
      .mockRejectedValueOnce(new Error("Nome scheda non valido."))
      .mockResolvedValueOnce({ ...WORKOUT_DETAIL, id: "new-2", name: "Scheda B" });

    const result = await importWorkoutsFromFile(TOKEN, [
      workout({ name: "Scheda A", exercises: [] }),
      workout({ name: "Scheda B", exercises: [] }),
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].name).toBe("Scheda B");
    expect(result.failed).toEqual([{ name: "Scheda A", message: "Errore imprevisto." }]);
  });
});

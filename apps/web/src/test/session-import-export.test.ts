import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Exercise, SessionDetail, WorkoutSummary } from "@gym-tracker/shared";
import { CsvImportError } from "../utils/csv";
import {
  SESSION_CSV_COLUMNS,
  analyzeSessionImport,
  buildSessionExportRows,
  importSessionsWithResolutions,
  parseSessionImportCsv,
  sessionsFilename,
  type PortableSession,
} from "../components/session-import-export";

const { listExercisesMock, createExerciseMock } = vi.hoisted(() => ({
  listExercisesMock: vi.fn(),
  createExerciseMock: vi.fn(),
}));
vi.mock("../api/exercises", () => ({
  listExercises: listExercisesMock,
  createExercise: createExerciseMock,
}));

const { listWorkoutsMock, createWorkoutMock } = vi.hoisted(() => ({
  listWorkoutsMock: vi.fn(),
  createWorkoutMock: vi.fn(),
}));
vi.mock("../api/workouts", () => ({
  listWorkouts: listWorkoutsMock,
  createWorkout: createWorkoutMock,
}));

const { logSessionMock } = vi.hoisted(() => ({ logSessionMock: vi.fn() }));
vi.mock("../api/sessions", () => ({
  logSession: logSessionMock,
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

const WORKOUTS: WorkoutSummary[] = [
  {
    id: "w1",
    name: "Push day",
    notes: null,
    exerciseCount: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const SESSION_DETAIL: SessionDetail = {
  id: "s1",
  workoutId: "w1",
  workoutName: "Push day",
  workoutNotes: null,
  performedAt: "2026-01-15T00:00:00.000Z",
  notes: "Buona sessione",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: 2.5,
      restSeconds: 90,
      sets: [
        {
          id: "set1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: 10,
          actualReps: 9,
          actualWeight: 60,
          actualRpe: 8,
          targetRestMinSeconds: 90,
          targetRestMaxSeconds: 120,
          actualRestSeconds: 100,
        },
      ],
    },
  ],
  createdAt: "2026-01-15T00:00:00.000Z",
};

describe("buildSessionExportRows / sessionsFilename", () => {
  it("costruisce una riga CSV per set con i valori effettivi", () => {
    const rows = buildSessionExportRows([SESSION_DETAIL]);
    expect(rows[0]).toEqual([...SESSION_CSV_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      "s1",
      "Push day",
      "2026-01-15",
      "Buona sessione",
      "Panca piana",
      "1",
      "90",
      "2.5",
      "1",
      "9",
      "60",
      "8",
      "100",
    ]);
  });

  it("genera un nome file .csv con la data odierna", () => {
    expect(sessionsFilename()).toMatch(/^gym-tracker-storico-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe("parseSessionImportCsv", () => {
  const HEADER = [...SESSION_CSV_COLUMNS];
  function csv(rows: string[][]): string {
    return rows.map((r) => r.join(";")).join("\r\n");
  }

  it("fa il round-trip di un export", () => {
    const exported = buildSessionExportRows([SESSION_DETAIL]);
    const reimported = parseSessionImportCsv(csv(exported));

    expect(reimported).toEqual<PortableSession[]>([
      {
        workoutName: "Push day",
        performedAt: "2026-01-15",
        notes: "Buona sessione",
        exercises: [
          {
            exerciseName: "Panca piana",
            position: 1,
            restSeconds: 90,
            progressionIncrement: 2.5,
            sets: [
              {
                setNumber: 1,
                actualReps: 9,
                actualWeight: 60,
                actualRpe: 8,
                actualRestSeconds: 100,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("raggruppa più righe con lo stesso id_sessione+scheda+data nella stessa sessione", () => {
    const rows = [
      HEADER,
      ["", "Push day", "2026-01-15", "", "Panca piana", "1", "", "", "1", "8", "", "", ""],
      ["", "Push day", "2026-01-15", "", "Squat", "2", "", "", "1", "5", "", "", ""],
    ];
    const result = parseSessionImportCsv(csv(rows));
    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(2);
  });

  it("distingue due sessioni con stessa scheda+data quando id_sessione è diverso", () => {
    const rows = [
      HEADER,
      ["a", "Push day", "2026-01-15", "", "Panca piana", "1", "", "", "1", "8", "", "", ""],
      ["b", "Push day", "2026-01-15", "", "Panca piana", "1", "", "", "1", "9", "", "", ""],
    ];
    const result = parseSessionImportCsv(csv(rows));
    expect(result).toHaveLength(2);
  });

  it("rifiuta una data in formato diverso da AAAA-MM-GG", () => {
    const rows = [
      HEADER,
      ["", "Push day", "15/01/2026", "", "Panca piana", "1", "", "", "1", "8", "", "", ""],
    ];
    expect(() => parseSessionImportCsv(csv(rows))).toThrow(/formato AAAA-MM-GG/);
  });

  it("rifiuta una riga senza rep_fatte", () => {
    const rows = [
      HEADER,
      ["", "Push day", "2026-01-15", "", "Panca piana", "1", "", "", "1", "", "", "", ""],
    ];
    expect(() => parseSessionImportCsv(csv(rows))).toThrow(/rep_fatte.*vuota/);
  });

  it("rifiuta un file senza le colonne obbligatorie", () => {
    expect(() => parseSessionImportCsv(csv([["scheda"], ["Push day"]]))).toThrow(
      /mancano le colonne obbligatorie/i
    );
  });

  it("rifiuta un file vuoto", () => {
    expect(() => parseSessionImportCsv("")).toThrow(CsvImportError);
  });
});

describe("analyzeSessionImport", () => {
  beforeEach(() => {
    listWorkoutsMock.mockReset();
  });

  function session(overrides: Partial<PortableSession> = {}): PortableSession {
    return {
      workoutName: "Push day",
      performedAt: "2026-01-15",
      notes: null,
      exercises: [
        {
          exerciseName: "Panca piana",
          position: 1,
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              setNumber: 1,
              actualReps: 8,
              actualWeight: 60,
              actualRpe: null,
              actualRestSeconds: null,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("risolve una scheda già nel catalogo (case-insensitive) senza crearne una nuova", async () => {
    listWorkoutsMock.mockResolvedValue(WORKOUTS);
    const result = await analyzeSessionImport(TOKEN, [session({ workoutName: "PUSH DAY" })]);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].workoutId).toBe("w1");
    expect(result.missing).toHaveLength(0);
  });

  it("raggruppa le sessioni con una scheda mancante, con anteprima dalla sessione più recente", async () => {
    listWorkoutsMock.mockResolvedValue(WORKOUTS);
    const older = session({ workoutName: "Gambe", performedAt: "2026-01-01" });
    const newer = session({
      workoutName: "Gambe",
      performedAt: "2026-01-10",
      exercises: [
        {
          exerciseName: "Squat",
          position: 1,
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              setNumber: 1,
              actualReps: 5,
              actualWeight: 80,
              actualRpe: null,
              actualRestSeconds: null,
            },
            {
              setNumber: 2,
              actualReps: 5,
              actualWeight: 80,
              actualRpe: null,
              actualRestSeconds: null,
            },
          ],
        },
      ],
    });
    const result = await analyzeSessionImport(TOKEN, [older, newer]);

    expect(result.resolved).toHaveLength(0);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].proposedName).toBe("Gambe");
    expect(result.missing[0].sessions).toHaveLength(2);
    expect(result.missing[0].preview).toEqual([{ exerciseName: "Squat", setCount: 2 }]);
    expect(result.existingWorkouts).toEqual(WORKOUTS);
  });
});

describe("importSessionsWithResolutions", () => {
  beforeEach(() => {
    listExercisesMock.mockReset();
    createExerciseMock.mockReset();
    listWorkoutsMock.mockReset();
    createWorkoutMock.mockReset();
    logSessionMock.mockReset();
  });

  function session(overrides: Partial<PortableSession> = {}): PortableSession {
    return {
      workoutName: "Push day",
      performedAt: "2026-01-15",
      notes: null,
      exercises: [
        {
          exerciseName: "Panca piana",
          position: 1,
          restSeconds: 90,
          progressionIncrement: null,
          sets: [
            {
              setNumber: 1,
              actualReps: 8,
              actualWeight: 60,
              actualRpe: null,
              actualRestSeconds: null,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("registra le sessioni già risolte usando l'id scheda del catalogo", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    logSessionMock.mockResolvedValue({ id: "new-session" });

    const analysis = {
      resolved: [{ session: session(), workoutId: "w1" }],
      missing: [],
      existingWorkouts: WORKOUTS,
    };
    const result = await importSessionsWithResolutions(TOKEN, analysis, []);

    expect(logSessionMock).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ workoutId: "w1", workoutName: "Push day" })
    );
    expect(result.createdSessions).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(createExerciseMock).not.toHaveBeenCalled();
  });

  it("salva il nome esercizio REALE del catalogo, non quello nel file se scritto con maiuscole/minuscole diverse", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    logSessionMock.mockResolvedValue({ id: "new-session" });

    const analysis = {
      resolved: [
        {
          session: session({ exercises: [{ ...session().exercises[0], exerciseName: "PANCA PIANA" }] }),
          workoutId: "w1",
        },
      ],
      missing: [],
      existingWorkouts: WORKOUTS,
    };
    await importSessionsWithResolutions(TOKEN, analysis, []);

    expect(createExerciseMock).not.toHaveBeenCalled();
    expect(logSessionMock).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({
        exercises: [expect.objectContaining({ exerciseId: "e1", exerciseName: "Panca piana" })],
      })
    );
  });

  it("azione 'create': crea la scheda ricostruita dalla sessione più recente del gruppo, poi registra tutte le sessioni del gruppo", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    createWorkoutMock.mockResolvedValue({ id: "new-workout", name: "Gambe" });
    logSessionMock.mockResolvedValue({ id: "new-session" });

    const group = {
      proposedName: "Gambe",
      sessions: [
        session({ workoutName: "Gambe" }),
        session({ workoutName: "Gambe", performedAt: "2026-01-20" }),
      ],
      preview: [{ exerciseName: "Panca piana", setCount: 1 }],
    };
    const analysis = { resolved: [], missing: [group], existingWorkouts: WORKOUTS };

    const result = await importSessionsWithResolutions(TOKEN, analysis, [
      { action: "create", name: "Gambe (ricostruita)" },
    ]);

    expect(createWorkoutMock).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({
        name: "Gambe (ricostruita)",
        exercises: [
          expect.objectContaining({
            exerciseId: "e1",
            sets: [
              expect.objectContaining({ targetMinReps: 8, targetWeight: 60, isMaxEffort: false }),
            ],
          }),
        ],
      })
    );
    expect(logSessionMock).toHaveBeenCalledTimes(2);
    expect(result.createdWorkoutNames).toEqual(["Gambe"]);
    expect(result.createdSessions).toHaveLength(2);
  });

  it("azione 'map': usa l'id della scheda esistente scelta, senza crearne una nuova", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    logSessionMock.mockResolvedValue({ id: "new-session" });

    const group = {
      proposedName: "Gambe pesanti",
      sessions: [session({ workoutName: "Gambe pesanti" })],
      preview: [],
    };
    const analysis = { resolved: [], missing: [group], existingWorkouts: WORKOUTS };

    await importSessionsWithResolutions(TOKEN, analysis, [{ action: "map", workoutId: "w1" }]);

    expect(createWorkoutMock).not.toHaveBeenCalled();
    // Il nome salvato sulla sessione deve essere quello della scheda REALE
    // scelta ("Push day", da WORKOUTS), non quello nel file ("Gambe
    // pesanti") — altrimenti lo snapshot resterebbe disallineato per sempre.
    expect(logSessionMock).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ workoutId: "w1", workoutName: "Push day" })
    );
  });

  it("azione 'skip': non registra le sessioni del gruppo, le riporta come fallite", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);

    const group = {
      proposedName: "Scheda dimenticata",
      sessions: [session({ workoutName: "Scheda dimenticata" })],
      preview: [],
    };
    const analysis = { resolved: [], missing: [group], existingWorkouts: [] };

    const result = await importSessionsWithResolutions(TOKEN, analysis, [{ action: "skip" }]);

    expect(logSessionMock).not.toHaveBeenCalled();
    expect(createWorkoutMock).not.toHaveBeenCalled();
    expect(result.failed).toEqual([
      {
        workoutName: "Scheda dimenticata",
        performedAt: "2026-01-15",
        message: "Scheda non creata (saltata).",
      },
    ]);
  });

  it("crea un esercizio personale una sola volta quando serve per più sessioni", async () => {
    listExercisesMock.mockResolvedValue([]);
    createExerciseMock.mockResolvedValue({
      id: "new-ex",
      userId: "u1",
      name: "Hip thrust",
      muscleGroup: null,
      description: null,
      sourceUrl: null,
    });
    logSessionMock.mockResolvedValue({ id: "new-session" });

    const hipThrustSession = session({
      exercises: [
        {
          exerciseName: "Hip thrust",
          position: 1,
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              setNumber: 1,
              actualReps: 10,
              actualWeight: 40,
              actualRpe: null,
              actualRestSeconds: null,
            },
          ],
        },
      ],
    });
    const analysis = {
      resolved: [
        { session: hipThrustSession, workoutId: "w1" },
        { session: { ...hipThrustSession, performedAt: "2026-01-20" }, workoutId: "w1" },
      ],
      missing: [],
      existingWorkouts: WORKOUTS,
    };

    await importSessionsWithResolutions(TOKEN, analysis, []);

    expect(createExerciseMock).toHaveBeenCalledTimes(1);
  });

  it("un fallimento su una sessione non blocca le altre", async () => {
    listExercisesMock.mockResolvedValue(CATALOG);
    logSessionMock
      .mockRejectedValueOnce(new Error("Dati non validi."))
      .mockResolvedValueOnce({ id: "ok-session" });

    const analysis = {
      resolved: [
        { session: session({ performedAt: "2026-01-01" }), workoutId: "w1" },
        { session: session({ performedAt: "2026-01-02" }), workoutId: "w1" },
      ],
      missing: [],
      existingWorkouts: WORKOUTS,
    };

    const result = await importSessionsWithResolutions(TOKEN, analysis, []);

    expect(result.createdSessions).toHaveLength(1);
    expect(result.failed).toEqual([
      { workoutName: "Push day", performedAt: "2026-01-01", message: "Errore imprevisto." },
    ]);
  });
});

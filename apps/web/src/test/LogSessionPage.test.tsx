import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { LogSessionPage } from "../pages/LogSessionPage";
import { Layout } from "../components/Layout";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

function stubNarrowViewport(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

function preferencesHandler(
  body: unknown = {
    prefillScope: "workout",
    timerSoundEnabled: false,
  }
) {
  return {
    match: (u: string, m: string) => u.endsWith("/me/account-preferences") && m === "GET",
    body,
  };
}

function progressionDefaultsHandler(body: unknown = []) {
  return {
    match: (u: string, m: string) => u.endsWith("/me/progression-defaults") && m === "GET",
    body,
  };
}

const WORKOUT_DETAIL = {
  id: "w1",
  name: "Push day",
  notes: null,
  exercises: [
    {
      id: "we1",
      exerciseId: "e1",
      exerciseName: "Panca piana",
      position: 1,
      notes: null,
      restSeconds: 90,
      progressionIncrement: 2.5,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 10,
          targetMaxReps: null,
          targetWeight: 80,
          restMinSeconds: 90,
          restMaxSeconds: 120,
          isMaxEffort: false,
        },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("LogSessionPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("precompila reps/peso/recupero dall'obiettivo della scheda quando non c'e' storico", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    const reps = (await screen.findByLabelText(
      /panca piana set 1 rep effettive/i
    )) as HTMLInputElement;
    expect(reps.value).toBe("10");
    const weight = screen.getByLabelText(/panca piana kg effettivi/i) as HTMLInputElement;
    expect(weight.value).toBe("80");
    const rest = screen.getByLabelText(/panca piana recupero effettivo/i) as HTMLInputElement;
    expect(rest.value).toBe("90");

    expect(screen.getByText("10")).toBeInTheDocument(); // obiettivo rep sopra la casella
    expect(screen.getByText("90-120s")).toBeInTheDocument(); // obiettivo recupero sopra la casella
    expect(screen.queryByLabelText(/^note$/i)).not.toBeInTheDocument();
  });

  it("mostra una riga separatrice con il recupero prima dell'esercizio successivo, tra un esercizio e l'altro", async () => {
    const twoExerciseWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        WORKOUT_DETAIL.exercises[0],
        {
          ...WORKOUT_DETAIL.exercises[0],
          id: "we2",
          exerciseId: "e2",
          exerciseName: "Trazioni",
          restSeconds: 120,
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: twoExerciseWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByText("Trazioni");
    expect(screen.getByText("Recupero prima del prossimo esercizio: 90s")).toBeInTheDocument();
    // Nessuna riga dopo l'ultimo esercizio (nessun esercizio successivo a cui riposare prima).
    expect(
      screen.queryByText(/Recupero prima del prossimo esercizio: 120s/)
    ).not.toBeInTheDocument();
  });

  it("su schermi stretti mostra un blocco per esercizio invece della tabella", async () => {
    stubNarrowViewport(true);
    const twoExerciseWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        WORKOUT_DETAIL.exercises[0],
        {
          ...WORKOUT_DETAIL.exercises[0],
          id: "we2",
          exerciseId: "e2",
          exerciseName: "Trazioni",
          restSeconds: 120,
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: twoExerciseWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByText("Trazioni");
    expect(document.querySelector(".log-session-table")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".stack-block")).toHaveLength(2);
    expect(screen.getByText("Recupero prima del prossimo esercizio: 90s")).toBeInTheDocument();

    const reps = screen.getByLabelText(/panca piana set 1 rep effettive/i) as HTMLInputElement;
    expect(reps.value).toBe("10");
    const weight = screen.getByLabelText(/panca piana kg effettivi/i) as HTMLInputElement;
    expect(weight.value).toBe("80");
    const rest = screen.getByLabelText(/panca piana recupero effettivo/i) as HTMLInputElement;
    expect(rest.value).toBe("90");
  });

  it("precompila rep/peso/recupero dall'ultima sessione registrata, non dall'obiettivo", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [
          {
            id: "sess0",
            workoutId: "w1",
            workoutName: "Push day",
            workoutNotes: null,
            performedAt: "2026-07-01T10:00:00.000Z",
            notes: null,
            exercises: [
              {
                exerciseId: "e1",
                exerciseName: "Panca piana",
                workoutExerciseId: "we1",
                progressionIncrement: 2.5,
                restSeconds: 90,
                sets: [
                  {
                    id: "s0",
                    setNumber: 1,
                    targetMinReps: 10,
                    targetMaxReps: null,
                    actualReps: 9,
                    actualWeight: 85,
                    actualRpe: null,
                    targetRestMinSeconds: 90,
                    targetRestMaxSeconds: 120,
                    actualRestSeconds: 100,
                  },
                ],
              },
            ],
            createdAt: "2026-07-01T10:00:00.000Z",
          },
        ],
      },
      preferencesHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    const reps = (await screen.findByLabelText(
      /panca piana set 1 rep effettive/i
    )) as HTMLInputElement;
    expect(reps.value).toBe("9");
    const weight = screen.getByLabelText(/panca piana kg effettivi/i) as HTMLInputElement;
    expect(weight.value).toBe("85");
    const rest = screen.getByLabelText(/panca piana recupero effettivo/i) as HTMLInputElement;
    expect(rest.value).toBe("100");
  });

  it("con prefillScope 'workout' (default), ignora lo storico dello stesso esercizio in un'altra scheda", async () => {
    const otherWorkoutSession = {
      id: "sess0",
      workoutId: "w2",
      workoutName: "Trazioni day",
      workoutNotes: null,
      performedAt: "2026-07-01T10:00:00.000Z",
      notes: null,
      exercises: [
        {
          exerciseId: "e1",
          exerciseName: "Panca piana",
          workoutExerciseId: "we-other",
          progressionIncrement: 2.5,
          restSeconds: 90,
          sets: [
            {
              id: "s0",
              setNumber: 1,
              targetMinReps: 10,
              targetMaxReps: null,
              actualReps: 9,
              actualWeight: 85,
              actualRpe: null,
              targetRestMinSeconds: 90,
              targetRestMaxSeconds: 120,
              actualRestSeconds: 100,
            },
          ],
        },
      ],
      createdAt: "2026-07-01T10:00:00.000Z",
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [otherWorkoutSession] },
      preferencesHandler({ prefillScope: "workout", timerSoundEnabled: false }),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    // Nessuno storico per la scheda w1: riparte dall'obiettivo della scheda (10), non da "9".
    const reps = (await screen.findByLabelText(
      /panca piana set 1 rep effettive/i
    )) as HTMLInputElement;
    expect(reps.value).toBe("10");
  });

  it("con prefillScope 'exercise', riporta le ultime rep dello stesso esercizio anche da un'altra scheda", async () => {
    const otherWorkoutSession = {
      id: "sess0",
      workoutId: "w2",
      workoutName: "Trazioni day",
      workoutNotes: null,
      performedAt: "2026-07-01T10:00:00.000Z",
      notes: null,
      exercises: [
        {
          exerciseId: "e1",
          exerciseName: "Panca piana",
          workoutExerciseId: "we-other",
          progressionIncrement: 2.5,
          restSeconds: 90,
          sets: [
            {
              id: "s0",
              setNumber: 1,
              targetMinReps: 10,
              targetMaxReps: null,
              actualReps: 9,
              actualWeight: 85,
              actualRpe: null,
              targetRestMinSeconds: 90,
              targetRestMaxSeconds: 120,
              actualRestSeconds: 100,
            },
          ],
        },
      ],
      createdAt: "2026-07-01T10:00:00.000Z",
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [otherWorkoutSession] },
      preferencesHandler({ prefillScope: "exercise", timerSoundEnabled: false }),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    // Stesso esercizio registrato in un'altra scheda (w2): con prefillScope
    // "exercise" riporta comunque le ultime rep effettive (9), non l'obiettivo.
    const reps = (await screen.findByLabelText(
      /panca piana set 1 rep effettive/i
    )) as HTMLInputElement;
    expect(reps.value).toBe("9");
  });

  it("registra la sessione con reps/peso/recupero effettivi", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      {
        match: (u, m) => u.endsWith("/sessions") && m === "POST",
        status: 201,
        body: {
          id: "sess1",
          workoutId: "w1",
          workoutName: "Push day",
          workoutNotes: null,
          performedAt: new Date().toISOString(),
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
        },
      },
      {
        match: (u, m) => u.endsWith("/sessions/sess1/status") && m === "GET",
        body: {
          status: "with-suggestion",
          suggestions: [
            {
              id: "pe1",
              exerciseId: "e1",
              exerciseName: "Panca piana",
              triggeringSessionId: "sess1",
              suggestionType: "increase_weight",
              previousValue: 80,
              suggestedValue: 82.5,
              reason:
                "Obiettivo di ripetizioni raggiunto per 2 sessioni consecutive a 80kg: aumenta il carico.",
              source: "rule",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByLabelText(/panca piana set 1 rep effettive/i);
    fireEvent.click(screen.getByRole("button", { name: /registra sessione/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    expect(body).toMatchObject({
      workoutId: "w1",
      workoutName: "Push day",
      exercises: [
        {
          exerciseId: "e1",
          progressionIncrement: 2.5,
          restSeconds: 90,
          sets: [
            {
              setNumber: 1,
              actualReps: 10,
              actualWeight: 80,
              targetRestMinSeconds: 90,
              targetRestMaxSeconds: 120,
              actualRestSeconds: 90,
            },
          ],
        },
      ],
    });
    expect(body.notes).toBeUndefined();

    expect(await screen.findByText(/aumenta il carico/i)).toBeInTheDocument();
  });

  it("mostra 'nessun suggerimento' quando il polling risolve senza suggerimenti", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      {
        match: (u, m) => u.endsWith("/sessions") && m === "POST",
        status: 201,
        body: {
          id: "sess1",
          workoutId: "w1",
          workoutName: "Push day",
          workoutNotes: null,
          performedAt: new Date().toISOString(),
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
        },
      },
      {
        match: (u, m) => u.endsWith("/sessions/sess1/status") && m === "GET",
        body: { status: "no-suggestion", suggestions: [] },
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByLabelText(/panca piana set 1 rep effettive/i);
    fireEvent.click(screen.getByRole("button", { name: /registra sessione/i }));

    expect(
      await screen.findByText("Nessun suggerimento di progressione questa volta.")
    ).toBeInTheDocument();
  });

  it("aggiorna il badge in Layout quando la sessione registrata produce un suggerimento", async () => {
    // Mock manuale (non mockFetchResponses) perche' serve stato: prima della
    // POST /sessions non c'e' ancora nessuna notifica non letta, dopo si'
    // (simula la notifica creata da notify-service a valle dell'evento).
    let suggestionCreated = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      const jsonResponse = (body: unknown, status = 200) => ({
        ok: status < 300,
        status,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
      });
      if (url.endsWith("/me") && method === "GET") {
        return jsonResponse(FAKE_USER);
      }
      if (url.endsWith("/workouts/w1") && method === "GET") {
        return jsonResponse(WORKOUT_DETAIL);
      }
      if (url.endsWith("/sessions") && method === "GET") {
        return jsonResponse([]);
      }
      if (url.endsWith("/me/account-preferences") && method === "GET") {
        return jsonResponse({ prefillScope: "workout", timerSoundEnabled: false });
      }
      if (url.endsWith("/me/progression-defaults") && method === "GET") {
        return jsonResponse([]);
      }
      if (url.includes("/notifications?unread=true") && method === "GET") {
        return jsonResponse(suggestionCreated ? [{ id: "n1" }] : []);
      }
      if (url.endsWith("/sessions") && method === "POST") {
        suggestionCreated = true;
        return jsonResponse(
          {
            id: "sess1",
            workoutId: "w1",
            workoutName: "Push day",
            workoutNotes: null,
            performedAt: new Date().toISOString(),
            notes: null,
            exercises: [],
            createdAt: new Date().toISOString(),
          },
          201
        );
      }
      if (url.endsWith("/sessions/sess1/status") && method === "GET") {
        return jsonResponse({
          status: "with-suggestion",
          suggestions: [
            {
              id: "pe1",
              exerciseId: "e1",
              exerciseName: "Panca piana",
              triggeringSessionId: "sess1",
              suggestionType: "increase_weight",
              previousValue: 80,
              suggestedValue: 82.5,
              reason:
                "Obiettivo di ripetizioni raggiunto per 2 sessioni consecutive a 80kg: aumenta il carico.",
              source: "rule",
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      throw new Error(`Nessun handler mockato per ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/workouts/:id/log" element={<LogSessionPage />} />
        </Route>
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByLabelText(/panca piana set 1 rep effettive/i);
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /registra sessione/i }));

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("per un set a sforzo massimo mostra 'Max' come obiettivo e parte con rep effettive vuote", async () => {
    const amrapWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          sets: [
            {
              id: "s1",
              setNumber: 1,
              targetMinReps: null,
              targetMaxReps: null,
              targetWeight: 80,
              restMinSeconds: null,
              restMaxSeconds: null,
              isMaxEffort: true,
            },
          ],
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: amrapWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    expect(await screen.findByText("Max")).toBeInTheDocument();
    const reps = screen.getByLabelText(/panca piana set 1 rep effettive/i) as HTMLInputElement;
    expect(reps.value).toBe("");
  });

  it("per un esercizio a corpo libero mostra 'corpo libero' senza casella per il peso", async () => {
    const bodyweightWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          sets: [{ ...WORKOUT_DETAIL.exercises[0].sets[0], targetWeight: null }],
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: bodyweightWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    expect(await screen.findByText("corpo libero")).toBeInTheDocument();
    expect(screen.queryByLabelText(/panca piana kg effettivi/i)).not.toBeInTheDocument();
  });

  it("un override 'accetta progressione' di peso sovrascrive il prefill dall'ultima sessione", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [
          {
            id: "sess0",
            workoutId: "w1",
            workoutName: "Push day",
            workoutNotes: null,
            performedAt: "2026-07-01T10:00:00.000Z",
            notes: null,
            exercises: [
              {
                exerciseId: "e1",
                exerciseName: "Panca piana",
                workoutExerciseId: "we1",
                progressionIncrement: 2.5,
                restSeconds: 90,
                sets: [
                  {
                    id: "set0",
                    setNumber: 1,
                    targetMinReps: 10,
                    targetMaxReps: null,
                    actualReps: 10,
                    actualWeight: 80,
                    actualRpe: null,
                    targetRestMinSeconds: 90,
                    targetRestMaxSeconds: 120,
                    actualRestSeconds: 90,
                  },
                ],
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ],
      },
      preferencesHandler(),
      progressionDefaultsHandler([
        { exerciseId: "e1", suggestionType: "increase_weight", value: 82.5 },
      ]),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    const weight = (await screen.findByLabelText(/panca piana kg effettivi/i)) as HTMLInputElement;
    expect(weight.value).toBe("82.5");
    // Le rep restano quelle dell'ultima sessione: l'override riguardava solo il peso.
    const reps = screen.getByLabelText(/panca piana set 1 rep effettive/i) as HTMLInputElement;
    expect(reps.value).toBe("10");
  });

  it("un override 'accetta progressione' di ripetizioni sovrascrive le rep di default su tutti i set", async () => {
    const twoSetWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          sets: [
            WORKOUT_DETAIL.exercises[0].sets[0],
            { ...WORKOUT_DETAIL.exercises[0].sets[0], id: "s2", setNumber: 2 },
          ],
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: twoSetWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      progressionDefaultsHandler([
        { exerciseId: "e1", suggestionType: "increase_reps", value: 11 },
      ]),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    const repsSet1 = (await screen.findByLabelText(
      /panca piana set 1 rep effettive/i
    )) as HTMLInputElement;
    const repsSet2 = screen.getByLabelText(/panca piana set 2 rep effettive/i) as HTMLInputElement;
    expect(repsSet1.value).toBe("11");
    expect(repsSet2.value).toBe("11");
  });

  it("avvia un timer di recupero tra le serie col valore della casella e lo mostra nel tray", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      progressionDefaultsHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByLabelText(/panca piana recupero effettivo/i);
    fireEvent.click(screen.getByRole("button", { name: /avvia timer recupero/i }));

    expect(await screen.findByText("Panca piana — recupero tra le serie")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^elimina$/i })).toBeInTheDocument();
  });

  it("disabilita il pulsante timer se la casella recupero e' vuota", async () => {
    const noRestWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          sets: [{ ...WORKOUT_DETAIL.exercises[0].sets[0], restMinSeconds: null }],
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: noRestWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      progressionDefaultsHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByLabelText(/panca piana recupero effettivo/i);
    expect(screen.getByRole("button", { name: /avvia timer recupero/i })).toBeDisabled();
  });

  it("avvia un timer di recupero tra esercizi con il valore fisso della scheda", async () => {
    const twoExerciseWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        WORKOUT_DETAIL.exercises[0],
        {
          ...WORKOUT_DETAIL.exercises[0],
          id: "we2",
          exerciseId: "e2",
          exerciseName: "Trazioni",
          restSeconds: 120,
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: twoExerciseWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      progressionDefaultsHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByText("Trazioni");
    const startButtons = screen.getAllByRole("button", { name: /avvia timer recupero/i });
    // Il primo e' quello del recupero tra le serie di "Panca piana"; il
    // secondo e' quello della riga separatrice "Recupero prima del
    // prossimo esercizio" (90s, il restSeconds di Panca piana).
    fireEvent.click(startButtons[1]);

    expect(await screen.findByText("Prima di Trazioni")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("disabilita tutti i pulsanti timer mentre uno e' gia' attivo", async () => {
    const twoExerciseWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        WORKOUT_DETAIL.exercises[0],
        {
          ...WORKOUT_DETAIL.exercises[0],
          id: "we2",
          exerciseId: "e2",
          exerciseName: "Trazioni",
          restSeconds: 120,
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: twoExerciseWorkout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      preferencesHandler(),
      progressionDefaultsHandler(),
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    await screen.findByText("Trazioni");
    const startButtons = screen.getAllByRole("button", { name: /avvia timer recupero/i });
    fireEvent.click(startButtons[0]);

    await screen.findByText("Panca piana — recupero tra le serie");
    for (const button of screen.getAllByRole("button", { name: /avvia timer recupero/i })) {
      expect(button).toBeDisabled();
    }

    fireEvent.click(screen.getByRole("button", { name: /^elimina$/i }));
    for (const button of screen.getAllByRole("button", { name: /avvia timer recupero/i })) {
      expect(button).not.toBeDisabled();
    }
  });

  describe("bozza locale (rete di sicurezza indipendente dal token)", () => {
    const DRAFT_KEY = "gym-tracker.log-session-draft.w1";

    it("salva una bozza in localStorage mentre si compila il form", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        preferencesHandler(),
      ]);

      renderWithProviders(
        <Routes>
          <Route path="/workouts/:id/log" element={<LogSessionPage />} />
        </Routes>,
        ["/workouts/w1/log"]
      );

      const reps = await screen.findByLabelText(/panca piana set 1 rep effettive/i);
      fireEvent.change(reps, { target: { value: "7" } });

      await waitFor(() => {
        const raw = localStorage.getItem(DRAFT_KEY);
        expect(raw).not.toBeNull();
        const draft = JSON.parse(raw as string);
        expect(draft.exercises[0].sets[0].actualReps).toBe("7");
      });
    });

    it("ripristina una bozza recente per la stessa scheda, con avviso", async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          performedAt: "2026-08-01",
          exercises: [
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
          ],
          savedAt: Date.now(),
        })
      );
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        preferencesHandler(),
      ]);

      renderWithProviders(
        <Routes>
          <Route path="/workouts/:id/log" element={<LogSessionPage />} />
        </Routes>,
        ["/workouts/w1/log"]
      );

      const reps = (await screen.findByLabelText(
        /panca piana set 1 rep effettive/i
      )) as HTMLInputElement;
      expect(reps.value).toBe("6");
      const weight = screen.getByLabelText(/panca piana kg effettivi/i) as HTMLInputElement;
      expect(weight.value).toBe("77.5");
      expect(screen.getByText(/bozza precedente ripristinata/i)).toBeInTheDocument();
    });

    it("ignora una bozza troppo vecchia (oltre 24 ore)", async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          performedAt: "2026-08-01",
          exercises: [],
          savedAt: Date.now() - 25 * 60 * 60 * 1000,
        })
      );
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        preferencesHandler(),
      ]);

      renderWithProviders(
        <Routes>
          <Route path="/workouts/:id/log" element={<LogSessionPage />} />
        </Routes>,
        ["/workouts/w1/log"]
      );

      const reps = (await screen.findByLabelText(
        /panca piana set 1 rep effettive/i
      )) as HTMLInputElement;
      expect(reps.value).toBe("10"); // obiettivo della scheda, non la bozza scartata
      expect(screen.queryByText(/bozza precedente ripristinata/i)).not.toBeInTheDocument();
    });

    it("'Scarta e ricomincia' torna ai valori di default e svuota la bozza salvata", async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          performedAt: "2026-08-01",
          exercises: [
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
          ],
          savedAt: Date.now(),
        })
      );
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        preferencesHandler(),
      ]);

      renderWithProviders(
        <Routes>
          <Route path="/workouts/:id/log" element={<LogSessionPage />} />
        </Routes>,
        ["/workouts/w1/log"]
      );

      await screen.findByText(/bozza precedente ripristinata/i);
      fireEvent.click(screen.getByRole("button", { name: /scarta e ricomincia/i }));

      const reps = screen.getByLabelText(/panca piana set 1 rep effettive/i) as HTMLInputElement;
      expect(reps.value).toBe("10");
      expect(screen.queryByText(/bozza precedente ripristinata/i)).not.toBeInTheDocument();
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("svuota la bozza dopo aver registrato la sessione con successo", async () => {
      const fetchMock = mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        preferencesHandler(),
        {
          match: (u, m) => u.endsWith("/sessions") && m === "POST",
          status: 201,
          body: {
            id: "sess1",
            workoutId: "w1",
            workoutName: "Push day",
            workoutNotes: null,
            performedAt: new Date().toISOString(),
            notes: null,
            exercises: [],
            createdAt: new Date().toISOString(),
          },
        },
        {
          match: (u, m) => u.endsWith("/sessions/sess1/status") && m === "GET",
          body: { status: "no-suggestion", suggestions: [] },
        },
      ]);

      renderWithProviders(
        <Routes>
          <Route path="/workouts/:id/log" element={<LogSessionPage />} />
        </Routes>,
        ["/workouts/w1/log"]
      );

      const reps = await screen.findByLabelText(/panca piana set 1 rep effettive/i);
      fireEvent.change(reps, { target: { value: "7" } });
      await waitFor(() => {
        expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
      });

      fireEvent.click(screen.getByRole("button", { name: /registra sessione/i }));

      await waitFor(() => {
        const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
        expect(postCall).toBeDefined();
      });
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { LogSessionPage } from "../pages/LogSessionPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

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
          restMinSeconds: null,
          restMaxSeconds: null,
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
    expect(screen.getByText("10")).toBeInTheDocument(); // target rep sopra la casella
    expect(screen.getByText("90s")).toBeInTheDocument(); // target recupero sopra la casella
  });

  it("precompila il peso dall'ultima sessione registrata, non dal target della scheda", async () => {
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
                actualRestSeconds: 90,
                sets: [
                  {
                    id: "s0",
                    setNumber: 1,
                    targetMinReps: 10,
                    targetMaxReps: null,
                    actualReps: 10,
                    actualWeight: 85,
                    actualRpe: null,
                  },
                ],
              },
            ],
            createdAt: "2026-07-01T10:00:00.000Z",
          },
        ],
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    const weight = (await screen.findByLabelText(/panca piana kg effettivi/i)) as HTMLInputElement;
    expect(weight.value).toBe("85");
  });

  it("registra la sessione con reps/peso/recupero effettivi", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
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
          actualRestSeconds: 90,
          sets: [{ setNumber: 1, actualReps: 10, actualWeight: 80 }],
        },
      ],
    });

    expect(await screen.findByText(/aumenta il carico/i)).toBeInTheDocument();
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
});

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
      restSeconds: null,
      progressionIncrement: 2.5,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 10,
          targetMaxReps: null,
          targetWeight: 80,
          restSeconds: null,
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

  it("precompila reps/peso dall'obiettivo della scheda", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id/log" element={<LogSessionPage />} />
      </Routes>,
      ["/workouts/w1/log"]
    );

    const reps = (await screen.findByLabelText(/reps effettive/i)) as HTMLInputElement;
    expect(reps.value).toBe("10");
    const weight = screen.getByLabelText(/peso effettivo/i) as HTMLInputElement;
    expect(weight.value).toBe("80");
  });

  it("registra la sessione e mostra il suggerimento restituito dal server", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "POST",
        status: 201,
        body: {
          id: "sess1",
          workoutId: "w1",
          workoutName: "Push day",
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

    await screen.findByLabelText(/reps effettive/i);
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
          sets: [{ setNumber: 1, actualReps: 10, actualWeight: 80 }],
        },
      ],
    });

    expect(await screen.findByText(/aumenta il carico/i)).toBeInTheDocument();
  });
});

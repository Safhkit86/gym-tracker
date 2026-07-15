import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { SessionDetailPage } from "../pages/SessionDetailPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const SESSION_DETAIL = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Push day",
  performedAt: "2026-07-08T10:00:00.000Z",
  notes: "Buona sensazione",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: 2.5,
      sets: [
        { id: "s1", setNumber: 1, targetReps: 10, actualReps: 10, actualWeight: 80, actualRpe: 8 },
      ],
    },
  ],
  createdAt: "2026-07-08T10:00:00.000Z",
};

describe("SessionDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra il dettaglio della sessione con reps/peso/RPE effettivi", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions/sess1") && m === "GET", body: SESSION_DETAIL },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
      </Routes>,
      ["/sessions/sess1"]
    );

    expect(await screen.findByText("Panca piana")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("elimina la sessione e torna allo storico", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions/sess1") && m === "GET", body: SESSION_DETAIL },
      { match: (u, m) => u.endsWith("/sessions/sess1") && m === "DELETE", status: 204 },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/sessions" element={<p>Storico allenamenti</p>} />
      </Routes>,
      ["/sessions/sess1"]
    );

    fireEvent.click(await screen.findByRole("button", { name: /elimina sessione/i }));

    await waitFor(() => {
      expect(screen.getByText("Storico allenamenti")).toBeInTheDocument();
    });
  });
});

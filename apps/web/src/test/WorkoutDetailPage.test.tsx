import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { WorkoutDetailPage } from "../pages/WorkoutDetailPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

describe("WorkoutDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const WORKOUT_DETAIL = {
    id: "w1",
    name: "Push day",
    notes: "Focus petto",
    exercises: [
      {
        id: "we1",
        exerciseId: "e1",
        exerciseName: "Panca piana",
        position: 1,
        notes: null,
        restSeconds: 120,
        progressionIncrement: 2.5,
        sets: [{ id: "s1", setNumber: 1, targetReps: 10, targetWeight: 40, restSeconds: 90 }],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("mostra il dettaglio della scheda con esercizi e set", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    expect(await screen.findByRole("heading", { name: "Push day" })).toBeInTheDocument();
    expect(screen.getByText("Panca piana")).toBeInTheDocument();
    expect(screen.getByText("40 kg")).toBeInTheDocument();
    expect(screen.getByText(/recupero prima del prossimo esercizio: 120s/i)).toBeInTheDocument();
  });

  it("mostra il link per registrare una sessione", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    const link = await screen.findByRole("link", { name: /registra sessione/i });
    expect(link).toHaveAttribute("href", "/workouts/w1/log");
  });

  it("mostra il link per modificare la scheda", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    const link = await screen.findByRole("link", { name: /modifica scheda/i });
    expect(link).toHaveAttribute("href", "/workouts/w1/edit");
  });

  it("mostra un suggerimento di progressione quando presente per un esercizio", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.includes("/progression") && m === "GET",
        body: [
          {
            id: "pe1",
            exerciseId: "e1",
            exerciseName: "Panca piana",
            triggeringSessionId: "s1",
            suggestionType: "increase_weight",
            previousValue: 40,
            suggestedValue: 42.5,
            reason:
              "Obiettivo di ripetizioni raggiunto per 2 sessioni consecutive a 40kg: aumenta il carico.",
            source: "rule",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    expect(await screen.findByText(/aumenta il carico/i)).toBeInTheDocument();
  });
});

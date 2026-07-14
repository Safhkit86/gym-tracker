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

  it("mostra il dettaglio della scheda con esercizi e set", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "GET",
        body: {
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
              sets: [{ id: "s1", setNumber: 1, targetReps: 10, targetWeight: 40, restSeconds: 90 }],
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
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
  });
});

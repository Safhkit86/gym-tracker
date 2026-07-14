import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { WorkoutsListPage } from "../pages/WorkoutsListPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

describe("WorkoutsListPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("elenca le schede con il conteggio esercizi", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          {
            id: "w1",
            name: "Push day",
            notes: null,
            exerciseCount: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByRole("link", { name: /push day/i })).toBeInTheDocument();
    expect(screen.getByText(/2 esercizi/)).toBeInTheDocument();
  });

  it("mostra un messaggio quando non ci sono schede", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByText("Non hai ancora nessuna scheda.")).toBeInTheDocument();
  });
});

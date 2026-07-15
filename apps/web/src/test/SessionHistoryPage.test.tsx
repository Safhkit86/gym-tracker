import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { SessionHistoryPage } from "../pages/SessionHistoryPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

describe("SessionHistoryPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra un messaggio quando non ci sono sessioni", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    expect(await screen.findByText(/non hai ancora registrato/i)).toBeInTheDocument();
  });

  it("elenca le sessioni registrate con link al dettaglio", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [
          {
            id: "sess1",
            workoutId: "w1",
            workoutName: "Push day",
            performedAt: "2026-07-08T10:00:00.000Z",
            exerciseCount: 1,
            createdAt: "2026-07-08T10:00:00.000Z",
          },
        ],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    const link = await screen.findByRole("link", { name: /push day/i });
    expect(link).toHaveAttribute("href", "/sessions/sess1");
  });
});

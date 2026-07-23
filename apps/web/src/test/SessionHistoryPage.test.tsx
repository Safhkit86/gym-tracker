import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { SessionHistoryPage } from "../pages/SessionHistoryPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const SESSION_OLDER = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Push day",
  performedAt: "2026-07-01T10:00:00.000Z",
  notes: "Buona sensazione",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: 2.5,
      restSeconds: 90,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 10,
          targetMaxReps: null,
          actualReps: 10,
          actualWeight: 80,
          actualRpe: 8,
        },
        {
          id: "s2",
          setNumber: 2,
          targetMinReps: 10,
          targetMaxReps: null,
          actualReps: 9,
          actualWeight: 80,
          actualRpe: 8,
        },
      ],
    },
  ],
  createdAt: "2026-07-01T10:00:00.000Z",
};

const SESSION_NEWER = {
  ...SESSION_OLDER,
  id: "sess2",
  performedAt: "2026-07-08T10:00:00.000Z",
  createdAt: "2026-07-08T10:00:00.000Z",
};

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

  it("mostra i dettagli di ogni sessione gia' espansi, dal piu' recente", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [SESSION_NEWER, SESSION_OLDER],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    expect(await screen.findAllByText("Panca piana")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /push day/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("80 kg")).toHaveLength(2);
    expect(screen.getAllByText("90s")).toHaveLength(2);

    const dates = screen.getAllByText(/2026/).map((el) => el.textContent);
    expect(dates[0]).toMatch(/08/);
    expect(dates[1]).toMatch(/01/);
  });

  it("il pulsante di ordinamento inverte l'ordine mostrato", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [SESSION_NEWER, SESSION_OLDER],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
    await screen.findAllByText("Panca piana");

    fireEvent.click(screen.getByRole("button", { name: /piu' recenti prima/i }));

    const dates = screen.getAllByText(/2026/).map((el) => el.textContent);
    expect(dates[0]).toMatch(/01/);
    expect(dates[1]).toMatch(/08/);
  });

  it("mostra un separatore di settimana quando ricomincia dalla scheda 1", async () => {
    const week1Monday = {
      ...SESSION_OLDER,
      id: "w1s1",
      workoutName: "1 - Lunedì",
      performedAt: "2026-07-06T10:00:00.000Z",
    };
    const week1Tuesday = {
      ...SESSION_OLDER,
      id: "w1s2",
      workoutName: "2 - Martedì",
      performedAt: "2026-07-07T10:00:00.000Z",
    };
    const week2Monday = {
      ...SESSION_OLDER,
      id: "w2s1",
      workoutName: "1 - Lunedì",
      performedAt: "2026-07-13T10:00:00.000Z",
    };
    const week2Tuesday = {
      ...SESSION_OLDER,
      id: "w2s2",
      workoutName: "2 - Martedì",
      performedAt: "2026-07-14T10:00:00.000Z",
    };

    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [week2Tuesday, week2Monday, week1Tuesday, week1Monday],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
    await screen.findAllByText("Panca piana");

    const dividers = screen.getAllByText(/Settimana \d/).map((el) => el.textContent);
    expect(dividers).toEqual(["Settimana 2", "Settimana 1"]);
  });

  it("elimina una sessione dopo conferma", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [SESSION_OLDER] },
      { match: (u, m) => u.endsWith("/sessions/sess1") && m === "DELETE", status: 204 },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
    await screen.findByText("Panca piana");

    fireEvent.click(screen.getByRole("button", { name: /elimina sessione/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sì" }));

    await waitFor(() => {
      expect(screen.getByText(/non hai ancora registrato/i)).toBeInTheDocument();
    });
  });
});

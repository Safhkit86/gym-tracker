import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { SessionHistoryPage } from "../pages/SessionHistoryPage";

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

const SESSION_OLDER = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Push day",
  workoutNotes: "Petto + Tricipiti",
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

    const notes = screen.getAllByText("Buona sensazione");
    expect(notes[0]).toHaveClass("session-card__notes");

    const workoutNotes = screen.getAllByText("Petto + Tricipiti");
    expect(workoutNotes).toHaveLength(2);
    expect(workoutNotes[0]).toHaveClass("session-card__notes");
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

  it("su schermi stretti mostra un blocco per esercizio invece della tabella", async () => {
    stubNarrowViewport(true);
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [SESSION_OLDER] },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    await screen.findByText("Panca piana");
    expect(document.querySelector("table")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".stack-block")).toHaveLength(1);
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
    expect(screen.getByText("90s")).toBeInTheDocument();
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

  describe("tab Misure", () => {
    // Delta tutti diversi tra loro apposta: altrimenti piu' campi
    // mostrerebbero lo stesso testo (es. "▲ 0.5") e getByText diventerebbe
    // ambiguo (piu' elementi corrispondenti).
    const ENTRY_NEWER = {
      id: "m2",
      measuredOn: "2026-07-20",
      weightKg: 79.1,
      chestCm: 101.5,
      armCm: 35.8,
      waistCm: 87,
      legCm: 58.2,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z",
    };
    const ENTRY_OLDER = {
      id: "m1",
      measuredOn: "2026-07-13",
      weightKg: 80,
      chestCm: 101,
      armCm: 35.5,
      waistCm: 88,
      legCm: 58,
      createdAt: "2026-07-13T10:00:00.000Z",
      updatedAt: "2026-07-13T10:00:00.000Z",
    };

    it("mostra un messaggio quando non ci sono misurazioni", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [] },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato nessuna sessione/i);

      fireEvent.click(screen.getByRole("button", { name: "Misure" }));

      expect(
        await screen.findByText(/non hai ancora registrato nessuna misurazione/i)
      ).toBeInTheDocument();
    });

    it("elenca le misurazioni con le frecce di variazione mostrate sulla voce piu' nuova", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/measurements") && m === "GET",
          body: [ENTRY_NEWER, ENTRY_OLDER],
        },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato nessuna sessione/i);
      fireEvent.click(screen.getByRole("button", { name: "Misure" }));

      expect(await screen.findByText("20/07/2026")).toBeInTheDocument();
      expect(screen.getByText("13/07/2026")).toBeInTheDocument();

      // La voce piu' nuova (20/07, peso 79.1) confrontata con la precedente
      // (13/07, peso 80) e' diminuita: freccia giu', mostrata sulla voce
      // nuova (non su quella vecchia).
      expect(screen.getByText("▼ 0.9")).toHaveClass("delta--down");
      // Petto e' aumentato (101 -> 101.5): freccia su.
      expect(screen.getByText("▲ 0.5")).toHaveClass("delta--up");
      // Una freccia per campo sulla voce piu' nuova; la piu' vecchia non ha
      // nulla con cui confrontarsi all'indietro, quindi nessuna freccia sua.
      expect(document.querySelectorAll(".delta")).toHaveLength(5);
    });

    it("elimina una misurazione dopo conferma", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [ENTRY_OLDER] },
        { match: (u, m) => u.endsWith("/measurements/m1") && m === "DELETE", status: 204 },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato nessuna sessione/i);
      fireEvent.click(screen.getByRole("button", { name: "Misure" }));
      await screen.findByText("13/07/2026");

      fireEvent.click(screen.getByRole("button", { name: /elimina misurazione/i }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Sì" }));

      await waitFor(() => {
        expect(
          screen.getByText(/non hai ancora registrato nessuna misurazione/i)
        ).toBeInTheDocument();
      });
    });
  });
});

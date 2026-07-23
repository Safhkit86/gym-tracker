import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
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

  it("mostra le note della scheda sotto il nome, se presenti", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          {
            id: "w1",
            name: "1 - Lunedì",
            notes: "Braccia + Petto + Addome",
            exerciseCount: 6,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByText("Braccia + Petto + Addome")).toBeInTheDocument();
  });

  it("mostra un messaggio quando non ci sono schede", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByText("Non hai ancora nessuna scheda.")).toBeInTheDocument();
  });

  const WORKOUT_SUMMARY = {
    id: "w1",
    name: "Push day",
    notes: null,
    exerciseCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("elimina una scheda dalla card dopo la conferma con 'Sì'", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "DELETE", status: 204 },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    await screen.findByRole("link", { name: /push day/i });
    fireEvent.click(screen.getByRole("button", { name: /elimina scheda/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^sì$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    });
    expect(screen.queryByRole("link", { name: /push day/i })).not.toBeInTheDocument();
  });

  it("annulla l'eliminazione dalla card su 'No' senza chiamare l'API", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    await screen.findByRole("link", { name: /push day/i });
    fireEvent.click(screen.getByRole("button", { name: /elimina scheda/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^no$/i }));

    expect(screen.getByRole("link", { name: /push day/i })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("duplica una scheda dalla card: fa il fetch del dettaglio solo alla conferma", async () => {
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
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              id: "s1",
              setNumber: 1,
              targetMinReps: 10,
              targetMaxReps: null,
              targetWeight: 40,
              restMinSeconds: null,
              restMaxSeconds: null,
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const DUPLICATED = { ...WORKOUT_DETAIL, id: "w2", name: "Push day (copia)" };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/workouts") && m === "POST", status: 201, body: DUPLICATED },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts" element={<WorkoutsListPage />} />
        <Route path="/workouts/:id" element={<p>Dettaglio scheda</p>} />
      </Routes>,
      ["/workouts"]
    );

    await screen.findByRole("link", { name: /push day/i });
    fireEvent.click(screen.getByRole("button", { name: /duplica scheda/i }));

    const input = await screen.findByLabelText(/nome della nuova scheda/i);
    expect(input).toHaveValue("Push day (copia)");
    // Annullando prima di confermare, nessuna chiamata di rete deve essere partita.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /^sì$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
    expect(await screen.findByText("Dettaglio scheda")).toBeInTheDocument();
  });
});

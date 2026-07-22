import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
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
        sets: [
          {
            id: "s1",
            setNumber: 1,
            targetMinReps: 10,
            targetMaxReps: null,
            targetWeight: 40,
            restMinSeconds: 60,
            restMaxSeconds: 90,
          },
        ],
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
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("60-90s")).toBeInTheDocument();
    expect(screen.getByText(/recupero prima del prossimo esercizio: 120s/i)).toBeInTheDocument();
  });

  it("mostra un range 'min-max' quando le rep massime sono impostate", async () => {
    const rangeWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          sets: [
            {
              id: "s1",
              setNumber: 1,
              targetMinReps: 8,
              targetMaxReps: 12,
              targetWeight: 40,
              restMinSeconds: 60,
              restMaxSeconds: 90,
            },
          ],
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: rangeWorkout },
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    expect(await screen.findByText("8-12")).toBeInTheDocument();
  });

  it("mostra 'Max' per un set a sforzo massimo (AMRAP)", async () => {
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
              targetWeight: null,
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
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    expect(await screen.findByText("Max")).toBeInTheDocument();
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

  it("chiede conferma prima di eliminare la scheda e annulla su 'No'", async () => {
    const fetchMock = mockFetchResponses([
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

    await screen.findByRole("heading", { name: "Push day" });
    fireEvent.click(screen.getByRole("button", { name: /elimina scheda/i }));

    expect(await screen.findByText("Sei sicuro di voler eliminare la scheda?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));

    expect(screen.queryByText("Sei sicuro di voler eliminare la scheda?")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Push day" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("elimina la scheda dopo la conferma con 'Sì'", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "DELETE", status: 204 },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
        <Route path="/workouts" element={<p>Le tue schede</p>} />
      </Routes>,
      ["/workouts/w1"]
    );

    await screen.findByRole("heading", { name: "Push day" });
    fireEvent.click(screen.getByRole("button", { name: /elimina scheda/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^sì$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    });
    expect(await screen.findByText("Le tue schede")).toBeInTheDocument();
  });

  it("chiede il nome prima di duplicare la scheda e annulla su 'No'", async () => {
    const fetchMock = mockFetchResponses([
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

    await screen.findByRole("heading", { name: "Push day" });
    fireEvent.click(screen.getByRole("button", { name: /duplica scheda/i }));

    const input = await screen.findByLabelText(/nome della nuova scheda/i);
    expect(input).toHaveValue("Push day (copia)");
    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));

    expect(screen.queryByLabelText(/nome della nuova scheda/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("duplica la scheda con il nome scelto e naviga alla copia", async () => {
    const DUPLICATED = { ...WORKOUT_DETAIL, id: "w2", name: "Push day v2" };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.includes("/progression") && m === "GET", body: [] },
      { match: (u, m) => u.endsWith("/workouts") && m === "POST", status: 201, body: DUPLICATED },
      { match: (u, m) => u.endsWith("/workouts/w2") && m === "GET", body: DUPLICATED },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>,
      ["/workouts/w1"]
    );

    await screen.findByRole("heading", { name: "Push day" });
    fireEvent.click(screen.getByRole("button", { name: /duplica scheda/i }));

    const input = await screen.findByLabelText(/nome della nuova scheda/i);
    fireEvent.change(input, { target: { value: "Push day v2" } });
    fireEvent.click(screen.getByRole("button", { name: /^sì$/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    expect(body).toMatchObject({
      name: "Push day v2",
      notes: "Focus petto",
      exercises: [
        {
          exerciseId: "e1",
          position: 1,
          restSeconds: 120,
          progressionIncrement: 2.5,
          sets: [
            {
              setNumber: 1,
              targetMinReps: 10,
              targetWeight: 40,
              restMinSeconds: 60,
              restMaxSeconds: 90,
            },
          ],
        },
      ],
    });
    expect(await screen.findByRole("heading", { name: "Push day v2" })).toBeInTheDocument();
  });
});

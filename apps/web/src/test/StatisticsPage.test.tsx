import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { StatisticsPage } from "../pages/StatisticsPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const EXERCISES = [
  { id: "e1", userId: null, name: "Dip", muscleGroup: "Petto", description: null, sourceUrl: null },
  {
    id: "e2",
    userId: null,
    name: "Curl a martello",
    muscleGroup: "Braccia",
    description: null,
    sourceUrl: null,
  },
];

const WORKOUTS = [
  { id: "w1", name: "Push day", notes: null, exerciseCount: 2, createdAt: "", updatedAt: "" },
];

function workoutExercise(id: string, exerciseId: string, exerciseName: string) {
  return {
    id,
    exerciseId,
    exerciseName,
    position: 1,
    notes: null,
    restSeconds: 90,
    progressionIncrement: 2.5,
    sets: [
      {
        id: `${id}-s1`,
        setNumber: 1,
        targetMinReps: 8,
        targetMaxReps: 12,
        targetWeight: 20,
        restMinSeconds: 60,
        restMaxSeconds: 90,
        isMaxEffort: false,
      },
    ],
  };
}

const WORKOUT_W1_DETAIL = {
  id: "w1",
  name: "Push day",
  notes: null,
  exercises: [workoutExercise("we1", "e1", "Dip"), workoutExercise("we2", "e2", "Curl a martello")],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const STATS = {
  sessionCount: 12,
  consecutiveWeeks: 4,
  totalKgLifted: 3240,
  currentWeekVolumeByExercise: [
    { exerciseId: "e1", exerciseName: "Dip", setCount: 4, repCount: 40 },
  ],
  recentExercises: [],
  streakCalendar: [],
};

const MEASUREMENTS = [
  {
    id: "m2",
    measuredOn: "2026-07-20",
    weightKg: 79.1,
    chestCm: 106,
    armCm: null,
    waistCm: null,
    legCm: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
  },
  {
    id: "m1",
    measuredOn: "2026-06-20",
    weightKg: 80.2,
    chestCm: 105,
    armCm: null,
    waistCm: null,
    legCm: null,
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  },
];

function baseHandlers(
  overrides: Array<{ match: (u: string, m: string) => boolean; body: unknown }> = []
) {
  return [
    ...overrides,
    { match: (u: string, m: string) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
    { match: (u: string, m: string) => u.endsWith("/stats") && m === "GET", body: STATS },
    { match: (u: string, m: string) => u.endsWith("/exercises") && m === "GET", body: EXERCISES },
    { match: (u: string, m: string) => u.endsWith("/workouts") && m === "GET", body: WORKOUTS },
    {
      match: (u: string, m: string) => u.endsWith("/workouts/w1") && m === "GET",
      body: WORKOUT_W1_DETAIL,
    },
    {
      match: (u: string, m: string) =>
        u.includes("exerciseId=e1") && u.includes("exercise-history") && m === "GET",
      body: [{ sessionId: "s1", performedAt: "2026-07-01T00:00:00.000Z", value: 40, unit: "kg" }],
    },
    {
      match: (u: string, m: string) =>
        u.includes("exerciseId=e2") && u.includes("exercise-history") && m === "GET",
      body: [{ sessionId: "s2", performedAt: "2026-07-01T00:00:00.000Z", value: 12, unit: "reps" }],
    },
    {
      match: (u: string, m: string) => u.endsWith("/measurements") && m === "GET",
      body: MEASUREMENTS,
    },
  ];
}

describe("StatisticsPage", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("mostra la stessa card Statistiche della Dashboard", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<StatisticsPage />} />
      </Routes>
    );

    await screen.findByText("12");
    const statTiles = document.querySelector(".stat-tiles") as HTMLElement;
    expect(within(statTiles).getByText("4")).toBeInTheDocument();
  });

  it("mostra le sezioni per gruppo muscolare sempre aperte, senza accordion", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<StatisticsPage />} />
      </Routes>
    );

    await screen.findByRole("heading", { level: 2, name: "Petto" });
    expect(screen.getByRole("heading", { level: 2, name: "Petto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Braccia" })).toBeInTheDocument();
    // Nessun <details>/accordion su questa pagina, a differenza della Dashboard.
    expect(document.querySelector("details")).not.toBeInTheDocument();
    // I grafici sono gia' a vista, senza dover cliccare nulla.
    await waitFor(() => {
      expect(screen.getAllByText(/— (peso|ripetizioni)/)).toHaveLength(2);
    });
  });

  it("carica lo storico misure solo al click sul tab Misure (lazy)", async () => {
    seedAuthToken();
    const fetchMock = mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<StatisticsPage />} />
      </Routes>
    );

    await screen.findByRole("heading", { level: 2, name: "Petto" });
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/measurements"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Misure" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/measurements"))).toBe(true);
    });
    expect(await screen.findByText(/Peso —/)).toBeInTheDocument();
    expect(screen.getByText(/Petto —/)).toBeInTheDocument();
    // Braccia/Vita/Gamba non hanno dati in questo fixture: nessun grafico per loro.
    expect(screen.getByText("Nessuna misurazione di braccia registrata.")).toBeInTheDocument();
  });
});

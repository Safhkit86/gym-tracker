import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { DashboardPage } from "../pages/DashboardPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const EXERCISES = [
  {
    id: "e1",
    ownerId: null,
    name: "Dip",
    muscleGroup: "Petto",
    description: null,
    sourceUrl: null,
  },
  {
    id: "e2",
    ownerId: null,
    name: "Curl a martello",
    muscleGroup: "Braccia",
    description: null,
    sourceUrl: null,
  },
];

const WORKOUTS = [
  { id: "w1", name: "Push day", notes: null, exerciseCount: 1, createdAt: "", updatedAt: "" },
  { id: "w2", name: "Pull day", notes: null, exerciseCount: 4, createdAt: "", updatedAt: "" },
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

const WORKOUT_W2_DETAIL = {
  id: "w2",
  name: "Pull day",
  notes: null,
  exercises: [
    workoutExercise("we1", "e2", "Curl a martello"),
    workoutExercise("we2", "e1", "Dip"),
    workoutExercise("we3", "e3", "Trazioni"),
    workoutExercise("we4", "e4", "Rematore"),
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const LAST_SESSION = {
  id: "s1",
  workoutId: "w1",
  workoutName: "Push day",
  workoutNotes: null,
  performedAt: "2026-07-20T10:00:00.000Z",
  notes: null,
  createdAt: "2026-07-20T10:00:00.000Z",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Dip",
      workoutExerciseId: "we1",
      progressionIncrement: null,
      restSeconds: null,
      sets: [
        {
          id: "ss1",
          setNumber: 1,
          targetMinReps: null,
          targetMaxReps: null,
          actualReps: 10,
          actualWeight: null,
          actualRpe: null,
          targetRestMinSeconds: null,
          targetRestMaxSeconds: null,
          actualRestSeconds: null,
        },
      ],
    },
  ],
};

const STATS = {
  sessionCount: 12,
  consecutiveWeeks: 4,
  totalKgLifted: 3240,
  currentWeekVolumeByExercise: [
    { exerciseId: "e1", exerciseName: "Dip", setCount: 4, repCount: 40 },
    { exerciseId: "e2", exerciseName: "Curl a martello", setCount: 3, repCount: 30 },
  ],
  recentExercises: [
    { exerciseId: "e1", exerciseName: "Dip" },
    { exerciseId: "e2", exerciseName: "Curl a martello" },
  ],
  streakCalendar: ["2026-07-15", "2026-07-20"],
};

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
      match: (u: string, m: string) => u.includes("/sessions?limit=1") && m === "GET",
      body: [LAST_SESSION],
    },
    {
      match: (u: string, m: string) => u.endsWith("/workouts/w2") && m === "GET",
      body: WORKOUT_W2_DETAIL,
    },
    {
      match: (u: string, m: string) => u.includes("/progression/stalled") && m === "GET",
      body: null,
    },
    {
      match: (u: string, m: string) => u.includes("/sessions/exercise-history") && m === "GET",
      body: [],
    },
  ];
}

describe("DashboardPage", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("mostra le statistiche principali", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("12");
    const statTiles = document.querySelector(".stat-tiles") as HTMLElement;
    expect(within(statTiles).getByText("4")).toBeInTheDocument();
    expect(
      within(statTiles).getByText((text) => text.replace(/\D/g, "") === "3240")
    ).toBeInTheDocument();
  });

  it("calcola la prossima scheda come quella successiva all'ultima sessione registrata", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    expect(await screen.findByText("Pull day")).toBeInTheDocument();
    const startLink = screen.getByRole("link", { name: "Avvia sessione" });
    expect(startLink).toHaveAttribute("href", "/workouts/w2/log");
  });

  it("pagina gli esercizi di 'Prossima sessione' mostrando solo 3 alla volta", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("Pull day");
    expect(screen.getByText("Curl a martello")).toBeInTheDocument();
    expect(screen.getByText("Trazioni")).toBeInTheDocument();
    expect(screen.queryByText("Rematore")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Esercizi successivi" }));
    expect(await screen.findByText("Rematore")).toBeInTheDocument();
  });

  it("mostra l'ultima sessione registrata", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    expect(await screen.findByText(/Push day/)).toBeInTheDocument();
    expect(screen.getByText("10 rip. · corpo libero")).toBeInTheDocument();
  });

  it("il suggerimento di progressione mostra una conferma prima di sparire dopo l'accetta", async () => {
    seedAuthToken();
    mockFetchResponses(
      baseHandlers([
        {
          match: (u, m) => u.includes("/notifications?unread=true") && m === "GET",
          body: [
            {
              id: "n1",
              exerciseId: "e1",
              exerciseName: "Dip",
              suggestionType: "increase_reps",
              previousValue: 10,
              suggestedValue: 11,
              reason: "test",
              triggeringSessionId: "s0",
              readAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        {
          match: (u, m) => u.includes("/me/progression-defaults") && m === "POST",
          body: undefined,
        },
        {
          match: (u, m) => u.includes("/notifications/n1/read") && m === "PATCH",
          body: undefined,
        },
      ])
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    const acceptButton = await screen.findByRole("button", { name: "Accetta" });
    fireEvent.click(acceptButton);

    expect(await screen.findByText("✓ Accettato")).toBeInTheDocument();
  });

  it("nasconde la card 'Esercizio in stallo' quando l'API torna null", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("Pull day");
    expect(screen.queryByText("Esercizio in stallo")).not.toBeInTheDocument();
  });

  it("mostra la card 'Esercizio in stallo' quando l'API restituisce un esercizio", async () => {
    seedAuthToken();
    mockFetchResponses(
      baseHandlers([
        {
          match: (u, m) => u.includes("/progression/stalled") && m === "GET",
          body: { exerciseId: "e1", exerciseName: "Dip", daysSinceLastProgression: 42 },
        },
      ])
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    const heading = await screen.findByText("Esercizio in stallo");
    const card = heading.closest(".card") as HTMLElement;
    expect(within(card).getByText("Dip")).toBeInTheDocument();
    expect(within(card).getByText(/6 settimane/)).toBeInTheDocument();
  });

  it("attende conferma prima di sparire; nel frattempo mostra ancora il secondo suggerimento", async () => {
    seedAuthToken();
    mockFetchResponses(
      baseHandlers([
        {
          match: (u, m) => u.includes("/notifications?unread=true") && m === "GET",
          body: [
            {
              id: "n1",
              exerciseId: "e1",
              exerciseName: "Dip",
              suggestionType: "increase_reps",
              previousValue: 10,
              suggestedValue: 11,
              reason: "test",
              triggeringSessionId: "s0",
              readAt: null,
              createdAt: new Date().toISOString(),
            },
            {
              id: "n2",
              exerciseId: "e2",
              exerciseName: "Curl a martello",
              suggestionType: "increase_weight",
              previousValue: 8,
              suggestedValue: 9,
              reason: "test",
              triggeringSessionId: "s0",
              readAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        {
          match: (u, m) => u.includes("/me/progression-defaults") && m === "POST",
          body: undefined,
        },
        { match: (u, m) => u.includes("/notifications/n1/read") && m === "PATCH", body: undefined },
      ])
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    const suggestionsHeading = await screen.findByText("Suggerimenti di progressione");
    const suggestionsCard = suggestionsHeading.closest(".card") as HTMLElement;
    const acceptButtons = within(suggestionsCard).getAllByRole("button", { name: "Accetta" });
    fireEvent.click(acceptButtons[0]);

    expect(await within(suggestionsCard).findByText("✓ Accettato")).toBeInTheDocument();
    expect(within(suggestionsCard).getByText("Curl a martello")).toBeInTheDocument();
    expect(within(suggestionsCard).getByRole("button", { name: "Accetta" })).toBeInTheDocument();
  });
});

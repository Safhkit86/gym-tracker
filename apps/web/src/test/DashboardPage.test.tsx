import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { DashboardPage } from "../pages/DashboardPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const EXERCISES = [
  {
    id: "e1",
    userId: null,
    name: "Dip",
    muscleGroup: "Petto",
    description: null,
    sourceUrl: null,
  },
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

const WORKOUT_W1_DETAIL = {
  id: "w1",
  name: "Push day",
  notes: null,
  exercises: [workoutExercise("we0", "e1", "Dip")],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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
      match: (u: string, m: string) => u.endsWith("/workouts/w1") && m === "GET",
      body: WORKOUT_W1_DETAIL,
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
    { match: (u: string, m: string) => u.endsWith("/measurements") && m === "GET", body: [] },
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
          match: (u, m) => u.includes("/notifications/n1/accept") && m === "PATCH",
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
        {
          match: (u, m) => u.includes("/notifications/n1/accept") && m === "PATCH",
          body: undefined,
        },
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

  it("accettando il suggerimento piu' recente di un esercizio, quello piu' vecchio dello stesso esercizio sparisce anche lui", async () => {
    seedAuthToken();
    mockFetchResponses(
      baseHandlers([
        {
          match: (u, m) => u.includes("/notifications?unread=true") && m === "GET",
          // Ordine come lo restituisce davvero il backend (created_at
          // decrescente, vedi notify-service): il più recente per primo.
          body: [
            {
              id: "n2-newer",
              exerciseId: "e1",
              exerciseName: "Dip",
              suggestionType: "increase_reps",
              previousValue: 11,
              suggestedValue: 12,
              reason: "test",
              triggeringSessionId: "s1",
              readAt: null,
              createdAt: "2026-08-02T10:00:00.000Z",
            },
            {
              id: "n1-older",
              exerciseId: "e1",
              exerciseName: "Dip",
              suggestionType: "increase_reps",
              previousValue: 10,
              suggestedValue: 11,
              reason: "test",
              triggeringSessionId: "s0",
              readAt: null,
              createdAt: "2026-08-01T10:00:00.000Z",
            },
          ],
        },
        {
          match: (u, m) => u.includes("/me/progression-defaults") && m === "POST",
          body: undefined,
        },
        {
          match: (u, m) => u.includes("/notifications/n2-newer/accept") && m === "PATCH",
          body: undefined,
        },
      ])
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    const suggestionsHeading = await screen.findByText("Suggerimenti di progressione");
    const suggestionsCard = suggestionsHeading.closest(".card") as HTMLElement;
    // Entrambi i suggerimenti sono per "Dip": due bottoni "Accetta" prima di
    // accettare il piu' recente (il secondo, visto che sono ordinati per
    // createdAt decrescente dal backend).
    const acceptButtons = within(suggestionsCard).getAllByRole("button", { name: "Accetta" });
    expect(acceptButtons).toHaveLength(2);
    fireEvent.click(acceptButtons[0]);

    await waitFor(
      () => {
        expect(within(suggestionsCard).queryByText("✓ Accettato")).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
    // acceptNotification segna lato server anche il suggerimento più vecchio
    // dello stesso esercizio: dopo l'animazione di conferma non deve restare
    // visibile con un pulsante "Accetta" ancora attivo.
    expect(
      within(suggestionsCard).queryByRole("button", { name: "Accetta" })
    ).not.toBeInTheDocument();
    expect(
      within(suggestionsCard).getByText("Nessun suggerimento in sospeso.")
    ).toBeInTheDocument();
  });

  it("apre un solo accordion di 'Progressioni per esercizio' alla volta", async () => {
    seedAuthToken();
    const exercisesFixture = [
      {
        id: "e1",
        userId: null,
        name: "Dip",
        muscleGroup: "Petto",
        description: null,
        sourceUrl: null,
      },
      {
        id: "e2",
        userId: null,
        name: "Curl a martello",
        muscleGroup: "Braccia",
        description: null,
        sourceUrl: null,
      },
    ];
    const workoutsFixture = [
      { id: "w1", name: "Push day", notes: null, exerciseCount: 2, createdAt: "", updatedAt: "" },
    ];
    const workoutDetail = {
      id: "w1",
      name: "Push day",
      notes: null,
      exercises: [
        workoutExercise("we1", "e1", "Dip"),
        workoutExercise("we2", "e2", "Curl a martello"),
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const statsFixture = {
      sessionCount: 0,
      consecutiveWeeks: 0,
      totalKgLifted: 0,
      currentWeekVolumeByExercise: [],
      recentExercises: [],
      streakCalendar: [],
    };

    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/stats") && m === "GET", body: statsFixture },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: exercisesFixture },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: workoutsFixture },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workoutDetail },
      { match: (u, m) => u.includes("/sessions?limit=1") && m === "GET", body: [] },
      { match: (u, m) => u.includes("/progression/stalled") && m === "GET", body: null },
      { match: (u, m) => u.includes("/sessions/exercise-history") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("Braccia");
    const braccia = screen.getByText("Braccia").closest("details") as HTMLDetailsElement;
    const petto = screen.getByText("Petto").closest("details") as HTMLDetailsElement;
    expect(braccia.open).toBe(true);
    expect(petto.open).toBe(false);

    fireEvent.click(screen.getByText("Petto"));
    expect(petto.open).toBe(true);
    expect(braccia.open).toBe(false);
  });

  it("unisce Polpacci nel gruppo muscolare Gambe", async () => {
    seedAuthToken();
    const exercisesFixture = [
      {
        id: "e1",
        userId: null,
        name: "Squat",
        muscleGroup: "Gambe",
        description: null,
        sourceUrl: null,
      },
      {
        id: "e2",
        userId: null,
        name: "Calf raise",
        muscleGroup: "Polpacci",
        description: null,
        sourceUrl: null,
      },
    ];
    const workoutsFixture = [
      { id: "w1", name: "Leg day", notes: null, exerciseCount: 2, createdAt: "", updatedAt: "" },
    ];
    const workoutDetail = {
      id: "w1",
      name: "Leg day",
      notes: null,
      exercises: [
        workoutExercise("we1", "e1", "Squat"),
        workoutExercise("we2", "e2", "Calf raise"),
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const statsFixture = {
      sessionCount: 0,
      consecutiveWeeks: 0,
      totalKgLifted: 0,
      currentWeekVolumeByExercise: [
        { exerciseId: "e1", exerciseName: "Squat", setCount: 3, repCount: 30 },
        { exerciseId: "e2", exerciseName: "Calf raise", setCount: 2, repCount: 20 },
      ],
      recentExercises: [],
      streakCalendar: [],
    };

    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/stats") && m === "GET", body: statsFixture },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: exercisesFixture },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: workoutsFixture },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workoutDetail },
      { match: (u, m) => u.includes("/sessions?limit=1") && m === "GET", body: [] },
      { match: (u, m) => u.includes("/progression/stalled") && m === "GET", body: null },
      { match: (u, m) => u.includes("/sessions/exercise-history") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("Sessioni registrate");
    expect(screen.queryByText("Polpacci")).not.toBeInTheDocument();
    const muscleGroupTile = document.querySelector(".muscle-group") as HTMLElement;
    expect(within(muscleGroupTile).getByText("Gambe")).toBeInTheDocument();
    expect(within(muscleGroupTile).getByText("5")).toBeInTheDocument();
  });

  it("mostra nei grafici solo gli esercizi ancora nelle schede attuali, il migliore in alto", async () => {
    seedAuthToken();
    const exercisesFixture = [
      {
        id: "e1",
        userId: null,
        name: "Dip",
        muscleGroup: "Petto",
        description: null,
        sourceUrl: null,
      },
      {
        id: "e2",
        userId: null,
        name: "Croci ai cavi",
        muscleGroup: "Petto",
        description: null,
        sourceUrl: null,
      },
    ];
    const workoutsFixture = [
      { id: "w1", name: "Push day", notes: null, exerciseCount: 2, createdAt: "", updatedAt: "" },
    ];
    const workoutDetail = {
      id: "w1",
      name: "Push day",
      notes: null,
      exercises: [
        workoutExercise("we1", "e1", "Dip"),
        workoutExercise("we2", "e2", "Croci ai cavi"),
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const statsFixture = {
      sessionCount: 0,
      consecutiveWeeks: 0,
      totalKgLifted: 0,
      currentWeekVolumeByExercise: [],
      // "Esercizio rimosso" non e' piu' in nessuna scheda attuale: non deve comparire.
      recentExercises: [{ exerciseId: "e9", exerciseName: "Esercizio rimosso" }],
      streakCalendar: [],
    };

    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/stats") && m === "GET", body: statsFixture },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: exercisesFixture },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: workoutsFixture },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workoutDetail },
      { match: (u, m) => u.includes("/sessions?limit=1") && m === "GET", body: [] },
      { match: (u, m) => u.includes("/progression/stalled") && m === "GET", body: null },
      {
        match: (u, m) =>
          u.includes("exerciseId=e1") && u.includes("exercise-history") && m === "GET",
        body: [{ sessionId: "s1", performedAt: "2026-07-01T00:00:00.000Z", value: 40, unit: "kg" }],
      },
      {
        match: (u, m) =>
          u.includes("exerciseId=e2") && u.includes("exercise-history") && m === "GET",
        body: [{ sessionId: "s2", performedAt: "2026-07-01T00:00:00.000Z", value: 90, unit: "kg" }],
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("Petto");
    expect(screen.queryByText(/Esercizio rimosso/)).not.toBeInTheDocument();

    // Lo storico arriva in modo asincrono (secondo useEffect): l'ordine per
    // risultato massimo si stabilizza solo dopo che entrambi sono arrivati,
    // quindi va ri-controllato con waitFor invece di una singola lettura.
    await waitFor(() => {
      const titles = screen.getAllByText(/— (peso|ripetizioni)/);
      expect(titles).toHaveLength(2);
      expect(titles[0].textContent).toMatch(/Croci ai cavi/);
      expect(titles[1].textContent).toMatch(/Dip/);
    });
  });

  it("nasconde la card 'Misure' quando non ci sono misurazioni", async () => {
    seedAuthToken();
    mockFetchResponses(baseHandlers());

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    await screen.findByText("Pull day");
    expect(screen.queryByRole("heading", { name: "Misure" })).not.toBeInTheDocument();
  });

  it("mostra le tile 'Misure' con valore, delta e link a Statistiche > Misure", async () => {
    seedAuthToken();
    mockFetchResponses(
      baseHandlers([
        {
          match: (u, m) => u.endsWith("/measurements") && m === "GET",
          body: [
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
          ],
        },
      ])
    );

    renderWithProviders(
      <Routes>
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    );

    const heading = await screen.findByRole("heading", { name: "Misure" });
    const card = heading.closest(".card") as HTMLElement;
    expect(within(card).getByText(/Peso/)).toBeInTheDocument();
    expect(within(card).getByText("79.1")).toBeInTheDocument();
    expect(within(card).getByText(/▼ 1\.1/)).toBeInTheDocument();
    // Braccia/Vita/Gamba non hanno dati in questo fixture: nessuna tile per loro.
    expect(within(card).queryByText("Braccia")).not.toBeInTheDocument();
    const link = within(card).getByRole("link", { name: "Vedi tutte →" });
    expect(link).toHaveAttribute("href", "/statistics?tab=measurements");
  });
});

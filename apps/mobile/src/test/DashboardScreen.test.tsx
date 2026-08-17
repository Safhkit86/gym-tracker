import * as SecureStore from "expo-secure-store";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithProviders, mockFetchResponses, setDeviceDimensions } from "./helpers";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";
import type { Props as DashboardScreenProps } from "../screens/dashboard/DashboardScreen";

type Props = DashboardScreenProps;

function mockNavigation(): Props["navigation"] {
  return {
    navigate: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  } as unknown as Props["navigation"];
}

function mockRoute(): Props["route"] {
  return {} as Props["route"];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const stats = {
  sessionCount: 5,
  consecutiveWeeks: 2,
  totalKgLifted: 1000,
  currentWeekVolumeByExercise: [{ exerciseId: "e1", setCount: 3, repCount: 24 }],
  recentExercises: [{ exerciseId: "e1", exerciseName: "Panca piana" }],
  streakCalendar: ["2026-08-01"],
};

const exercises = [
  {
    id: "e1",
    userId: null,
    name: "Panca piana",
    muscleGroup: "Petto",
    description: null,
    sourceUrl: null,
  },
];

const workoutSummaries = [
  { id: "w1", name: "Scheda A", notes: null, exerciseCount: 1, createdAt: "", updatedAt: "" },
];

const workoutDetail = {
  id: "w1",
  name: "Scheda A",
  notes: null,
  createdAt: "",
  updatedAt: "",
  exercises: [
    {
      id: "we1",
      exerciseId: "e1",
      exerciseName: "Panca piana",
      position: 1,
      notes: null,
      restSeconds: 90,
      progressionIncrement: null,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: 10,
          targetWeight: 60,
          restMinSeconds: 90,
          restMaxSeconds: null,
          isMaxEffort: false,
        },
      ],
    },
  ],
};

const lastSession = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Scheda A",
  workoutNotes: null,
  performedAt: "2026-08-01T10:00:00.000Z",
  notes: null,
  createdAt: "",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: null,
      restSeconds: 90,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: 10,
          actualReps: 9,
          actualWeight: 60,
          actualRpe: null,
          targetRestMinSeconds: 90,
          targetRestMaxSeconds: null,
          actualRestSeconds: 90,
        },
      ],
    },
  ],
};

const notification = {
  id: "n1",
  exerciseId: "e1",
  exerciseName: "Panca piana",
  suggestionType: "increase_weight" as const,
  previousValue: 60,
  suggestedValue: 62.5,
  reason: "3 sessioni consecutive nel range massimo.",
  triggeringSessionId: "sess1",
  readAt: null,
  createdAt: "",
};

const stalled = { exerciseId: "e2", exerciseName: "Squat", daysSinceLastProgression: 21 };

function baseHandlers() {
  return [
    { match: (u: string, m: string) => u.endsWith("/me") && m === "GET", body: fakeUser },
    { match: (u: string, m: string) => u.endsWith("/stats") && m === "GET", body: stats },
    { match: (u: string, m: string) => u.endsWith("/exercises") && m === "GET", body: exercises },
    {
      match: (u: string, m: string) => u.endsWith("/workouts") && m === "GET",
      body: workoutSummaries,
    },
    {
      match: (u: string, m: string) => u.endsWith("/workouts/w1") && m === "GET",
      body: workoutDetail,
    },
    {
      match: (u: string, m: string) => u.includes("/sessions?limit=1") && m === "GET",
      body: [lastSession],
    },
    {
      match: (u: string, m: string) =>
        u.includes("/notifications") && u.includes("unread=true") && m === "GET",
      body: [notification],
    },
    {
      match: (u: string, m: string) => u.endsWith("/progression/stalled") && m === "GET",
      body: stalled,
    },
    { match: (u: string, m: string) => u.endsWith("/measurements") && m === "GET", body: [] },
    {
      match: (u: string, m: string) => u.includes("/sessions/exercise-history") && m === "GET",
      body: [
        {
          sessionId: "sess1",
          performedAt: "2026-08-01T10:00:00.000Z",
          value: 60,
          unit: "kg" as const,
        },
      ],
    },
    {
      match: (u: string, m: string) => u.endsWith("/me/progression-defaults") && m === "POST",
      body: undefined,
    },
    {
      match: (u: string, m: string) => u.endsWith("/notifications/n1/accept") && m === "PATCH",
      body: undefined,
    },
  ];
}

describe("DashboardScreen", () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setDeviceDimensions("phone");
  });

  it("su tablet (portrait e landscape) mostra tutte le card nelle colonne esplicite", async () => {
    mockFetchResponses(baseHandlers());

    setDeviceDimensions("tabletPortrait");
    const portraitScreen = await renderWithProviders(
      <DashboardScreen navigation={mockNavigation()} route={mockRoute()} />
    );
    expect(await portraitScreen.findByText("Costanza recente")).toBeTruthy();
    expect(portraitScreen.getByText("Progressioni per esercizio")).toBeTruthy();
    expect(portraitScreen.getByText("Squat")).toBeTruthy();
    portraitScreen.unmount();

    setDeviceDimensions("tabletLandscape");
    const landscapeScreen = await renderWithProviders(
      <DashboardScreen navigation={mockNavigation()} route={mockRoute()} />
    );
    expect(await landscapeScreen.findByText("Costanza recente")).toBeTruthy();
    expect(landscapeScreen.getByText("Progressioni per esercizio")).toBeTruthy();
    expect(landscapeScreen.getByText("Squat")).toBeTruthy();
  });

  it("mostra statistiche, suggerimenti, stallo e naviga su Avvia sessione", async () => {
    const fetchMock = mockFetchResponses(baseHandlers());

    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <DashboardScreen navigation={navigation} route={mockRoute()} />
    );

    expect(await screen.findByText("5")).toBeTruthy();
    expect(screen.getByText("60kg → 62.5kg")).toBeTruthy();
    expect(screen.getByText("Squat")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Avvia sessione" }));
    expect(navigation.navigate).toHaveBeenCalledWith("Workouts", {
      screen: "LogSession",
      params: { id: "w1" },
    });

    fireEvent.press(screen.getByRole("button", { name: "Accetta" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/me/progression-defaults"),
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/n1/accept"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
    expect(await screen.findByText("✓ Accettato")).toBeTruthy();
  });

  it("accettando il suggerimento piu' recente di un esercizio, quello piu' vecchio dello stesso esercizio sparisce anche lui", async () => {
    const olderNotification = {
      ...notification,
      id: "n1-older",
      createdAt: "2026-08-01T10:00:00.000Z",
    };
    const newerNotification = {
      ...notification,
      id: "n2-newer",
      createdAt: "2026-08-02T10:00:00.000Z",
    };
    const fetchMock = mockFetchResponses([
      // Handler messi prima di ...baseHandlers(): mockFetchResponses usa
      // il primo match, quindi questi sovrascrivono l'unica notifica e
      // l'endpoint /accept di baseHandlers() senza doverli filtrare via.
      {
        match: (u: string, m: string) =>
          u.includes("/notifications") && u.includes("unread=true") && m === "GET",
        // Ordine come lo restituisce davvero il backend (created_at
        // decrescente): il più recente per primo.
        body: [newerNotification, olderNotification],
      },
      {
        match: (u: string, m: string) =>
          u.endsWith("/notifications/n2-newer/accept") && m === "PATCH",
        body: undefined,
      },
      ...baseHandlers(),
    ]);

    const screen = await renderWithProviders(
      <DashboardScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    const acceptButtons = await screen.findAllByRole("button", { name: "Accetta" });
    expect(acceptButtons).toHaveLength(2);
    fireEvent.press(acceptButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/n2-newer/accept"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
    expect(await screen.findByText("✓ Accettato")).toBeTruthy();

    await waitFor(
      () => {
        expect(screen.queryByText("✓ Accettato")).toBeNull();
      },
      { timeout: 3000 }
    );
    // acceptNotification segna lato server anche il suggerimento più vecchio
    // dello stesso esercizio: dopo l'animazione di conferma non deve restare
    // visibile con un pulsante "Accetta" ancora attivo.
    expect(screen.queryByRole("button", { name: "Accetta" })).toBeNull();
    expect(screen.getByText("Nessun suggerimento in sospeso.")).toBeTruthy();
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [] },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
      { match: (u, m) => u.includes("/sessions?limit=1") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/stats") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(
      <DashboardScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });
});

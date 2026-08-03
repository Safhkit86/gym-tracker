import * as SecureStore from "expo-secure-store";
import { fireEvent } from "@testing-library/react-native";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { StatisticsScreen } from "../screens/statistics/StatisticsScreen";

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const stats = {
  sessionCount: 5,
  consecutiveWeeks: 2,
  totalKgLifted: 1000,
  currentWeekVolumeByExercise: [{ exerciseId: "e1", setCount: 3, repCount: 24 }],
  recentExercises: [{ exerciseId: "e1", exerciseName: "Panca piana" }],
  streakCalendar: [],
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

const measurementNew = {
  id: "m1",
  measuredOn: "2026-08-01",
  weightKg: 79,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
  createdAt: "",
  updatedAt: "",
};

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
  ];
}

describe("StatisticsScreen", () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra le statistiche e i grafici per gruppo muscolare", async () => {
    mockFetchResponses(baseHandlers());

    const screen = await renderWithProviders(<StatisticsScreen />);

    expect(await screen.findByText("5")).toBeTruthy();
    expect(screen.getAllByText("Petto").length).toBeGreaterThan(0);
    expect(screen.getByText("Panca piana — peso (kg)")).toBeTruthy();
    expect(await screen.findByText("60kg")).toBeTruthy();
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [] },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/stats") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(<StatisticsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });

  it("carica le misure solo al primo tocco sul tab e mostra il grafico", async () => {
    mockFetchResponses([
      ...baseHandlers(),
      {
        match: (u: string, m: string) => u.endsWith("/measurements") && m === "GET",
        body: [measurementNew],
      },
    ]);

    const screen = await renderWithProviders(<StatisticsScreen />);

    await screen.findByText("Panca piana — peso (kg)");
    fireEvent.press(screen.getByRole("button", { name: "Misure" }));

    expect(await screen.findByText("Peso — kg")).toBeTruthy();
    expect(screen.getByText("79kg")).toBeTruthy();
  });
});

import * as SecureStore from "expo-secure-store";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { WorkoutDetailScreen } from "../screens/workouts/WorkoutDetailScreen";
import type { WorkoutsStackParamList } from "../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "WorkoutDetail">;

function mockNavigation(): Props["navigation"] {
  return { navigate: jest.fn() } as unknown as Props["navigation"];
}

function mockRoute(id: string): Props["route"] {
  return { params: { id } } as Props["route"];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

// Stesso motivo di WorkoutsListScreen.test.tsx: serve un token idratato +
// GET /me mockato perche' la schermata legge useAuth().token.
beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("WorkoutDetailScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra esercizi e set della scheda", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "GET",
        body: {
          id: "w1",
          name: "Spinta",
          notes: "Petto e tricipiti",
          createdAt: "",
          updatedAt: "",
          exercises: [
            {
              id: "we1",
              exerciseId: "e1",
              exerciseName: "Panca piana",
              position: 1,
              notes: null,
              restSeconds: 120,
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
                {
                  id: "s2",
                  setNumber: 2,
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
        },
      },
    ]);

    const screen = await renderWithProviders(
      <WorkoutDetailScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    expect(await screen.findByText("Spinta")).toBeTruthy();
    expect(screen.getByText("Petto e tricipiti")).toBeTruthy();
    expect(screen.getByText("Panca piana")).toBeTruthy();
    expect(screen.getByText("8-10")).toBeTruthy();
    expect(screen.getByText("60 kg")).toBeTruthy();
    expect(screen.getByText("90s")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();
    expect(screen.getByText("corpo libero")).toBeTruthy();
    expect(screen.getByText("Recupero prima del prossimo esercizio: 120s")).toBeTruthy();
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "GET",
        status: 404,
        body: { code: "NOT_FOUND", message: "Scheda non trovata." },
      },
    ]);

    const screen = await renderWithProviders(
      <WorkoutDetailScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Scheda non trovata.");
  });
});

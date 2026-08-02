import * as SecureStore from "expo-secure-store";
import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { CreateWorkoutScreen } from "../screens/workouts/CreateWorkoutScreen";
import type { WorkoutsStackParamList } from "../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "CreateWorkout">;

function mockNavigation(): Props["navigation"] {
  return { replace: jest.fn() } as unknown as Props["navigation"];
}

const emptyRoute = {} as Props["route"];

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const catalog = [
  { id: "e1", userId: null, name: "Panca piana", muscleGroup: "Petto", description: null, sourceUrl: null },
];

beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("CreateWorkoutScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("crea una scheda e naviga al dettaglio", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: catalog },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        body: {
          id: "w1",
          name: "Scheda A",
          notes: null,
          createdAt: "",
          updatedAt: "",
          exercises: [],
        },
      },
    ]);

    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <CreateWorkoutScreen navigation={navigation} route={emptyRoute} />
    );

    fireEvent.changeText(await screen.findByLabelText("Nome"), "Scheda A");
    fireEvent.changeText(screen.getByLabelText("Rep minime 0.0"), "8");
    fireEvent.press(screen.getByRole("button", { name: "Crea scheda" }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("WorkoutDetail", { id: "w1" });
    });
  });

  it("mostra un errore se la creazione fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: catalog },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 400,
        body: {
          code: "VALIDATION_ERROR",
          message: "Dati non validi. Controlla i campi e riprova.",
          details: { issues: [{ path: "name", message: "Nome obbligatorio" }] },
        },
      },
    ]);

    const screen = await renderWithProviders(
      <CreateWorkoutScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    await screen.findByLabelText("Nome");
    fireEvent.press(screen.getByRole("button", { name: "Crea scheda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dati non validi. Controlla i campi e riprova."
    );
  });

  it("mostra un errore se il catalogo non si carica", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/exercises") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(
      <CreateWorkoutScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });
});

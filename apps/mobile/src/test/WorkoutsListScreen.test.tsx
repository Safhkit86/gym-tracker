import * as SecureStore from "expo-secure-store";
import { fireEvent } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { WorkoutsListScreen } from "../screens/workouts/WorkoutsListScreen";
import type { WorkoutsStackParamList } from "../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "WorkoutsList">;

// Solo `navigate' e' usato da WorkoutsListScreen: il resto dell'oggetto
// navigation non serve in questi test, da qui il cast (stesso pattern di
// LoginScreen.test.tsx/RegisterScreen.test.tsx).
function mockNavigation(): Props["navigation"] {
  return { navigate: jest.fn() } as unknown as Props["navigation"];
}

const emptyRoute = {} as Props["route"];

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

// WorkoutsListScreen legge il token da useAuth(): AuthProvider lo idrata da
// SecureStore al mount e poi verifica la sessione con GET /me, quindi ogni
// test deve pre-popolare il token mockato e mockare anche /me, non solo
// l'endpoint sotto test.
beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("WorkoutsListScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra le schede caricate dal backend", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          { id: "w1", name: "Spinta", notes: null, exerciseCount: 3, createdAt: "", updatedAt: "" },
          {
            id: "w2",
            name: "Tirata",
            notes: "Focus dorso",
            exerciseCount: 1,
            createdAt: "",
            updatedAt: "",
          },
        ],
      },
    ]);

    const screen = await renderWithProviders(
      <WorkoutsListScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    expect(await screen.findByText("Spinta")).toBeTruthy();
    expect(screen.getByText("Tirata")).toBeTruthy();
    expect(screen.getByText("Focus dorso")).toBeTruthy();
    expect(screen.getByText("3 esercizi")).toBeTruthy();
    expect(screen.getByText("1 esercizio")).toBeTruthy();
  });

  it("mostra lo stato vuoto quando non ci sono schede", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
    ]);

    const screen = await renderWithProviders(
      <WorkoutsListScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    expect(await screen.findByText("Non hai ancora nessuna scheda.")).toBeTruthy();
  });

  it("naviga al dettaglio quando si tocca una scheda", async () => {
    const navigation = mockNavigation();
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          { id: "w1", name: "Spinta", notes: null, exerciseCount: 3, createdAt: "", updatedAt: "" },
        ],
      },
    ]);

    const screen = await renderWithProviders(
      <WorkoutsListScreen navigation={navigation} route={emptyRoute} />
    );

    await screen.findByText("Spinta");
    fireEvent.press(screen.getByRole("button", { name: "Spinta" }));

    expect(navigation.navigate).toHaveBeenCalledWith("WorkoutDetail", { id: "w1" });
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(
      <WorkoutsListScreen navigation={mockNavigation()} route={emptyRoute} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });
});

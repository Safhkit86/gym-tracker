import * as SecureStore from "expo-secure-store";
import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { EditWorkoutScreen } from "../screens/workouts/EditWorkoutScreen";
import type { WorkoutsStackParamList } from "../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "EditWorkout">;

function mockNavigation(): Props["navigation"] {
  return { popTo: jest.fn() } as unknown as Props["navigation"];
}

function mockRoute(id: string): Props["route"] {
  return { params: { id } } as Props["route"];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const catalog = [
  {
    id: "e1",
    userId: null,
    name: "Panca piana",
    muscleGroup: "Petto",
    description: null,
    sourceUrl: null,
  },
];

const existingWorkout = {
  id: "w1",
  name: "Spinta",
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
      restSeconds: null,
      progressionIncrement: null,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: null,
          targetWeight: 60,
          restMinSeconds: null,
          restMaxSeconds: null,
          isMaxEffort: false,
        },
      ],
    },
  ],
};

beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("EditWorkoutScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("precompila il form con i valori esistenti e salva le modifiche", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: catalog },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: existingWorkout },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT",
        body: { ...existingWorkout, name: "Spinta modificata" },
      },
    ]);

    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <EditWorkoutScreen navigation={navigation} route={mockRoute("w1")} />
    );

    const nameInput = await screen.findByLabelText("Nome");
    expect(nameInput.props.value).toBe("Spinta");
    expect(screen.getByLabelText("Rep minime 0.0").props.value).toBe("8");

    fireEvent.changeText(nameInput, "Spinta modificata");
    fireEvent.press(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => {
      expect(navigation.popTo).toHaveBeenCalledWith("WorkoutDetail", { id: "w1" });
    });
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: catalog },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "GET",
        status: 404,
        body: { code: "NOT_FOUND", message: "Scheda non trovata." },
      },
    ]);

    const screen = await renderWithProviders(
      <EditWorkoutScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Scheda non trovata.");
  });
});

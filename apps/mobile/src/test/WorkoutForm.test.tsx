import * as SecureStore from "expo-secure-store";
import { fireEvent } from "@testing-library/react-native";
import {
  StyleSheet,
  Text as MockText,
  TouchableOpacity as MockTouchableOpacity,
} from "react-native";
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

// ExerciseCombobox e' sostituita con un doppio minimale (un bottone "apri" +
// un bottone "chiudi" che richiamano direttamente onOpenChange) per isolare
// la meccanica che questo test vuole verificare (il plumbing
// WorkoutForm → ExerciseCard → onComboboxOpenChange → CellRendererComponent)
// da quella interna di ExerciseCombobox, gia' verificata a parte in
// ExerciseCombobox.test.tsx. Necessario anche per un motivo tecnico: la
// combobox reale annida una FlatList dentro quella delle card (altra
// FlatList) — qualunque sua apertura+chiusura/smontaggio, con o senza
// questo fix, fa scattare un "Invariant Violation: Trying to remove
// non-present child list" sotto react-test-renderer (riprodotto anche
// sul codice pre-fix, non originato da questo cambiamento: limite noto di
// react-test-renderer con VirtualizedList annidate su due livelli).
jest.mock("../screens/workouts/ExerciseCombobox", () => ({
  ExerciseCombobox: ({ onOpenChange }: { onOpenChange: (isOpen: boolean) => void }) => (
    <>
      <MockTouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="apri-combobox"
        onPress={() => onOpenChange(true)}
      >
        <MockText>apri</MockText>
      </MockTouchableOpacity>
      <MockTouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="chiudi-combobox"
        onPress={() => onOpenChange(false)}
      >
        <MockText>chiudi</MockText>
      </MockTouchableOpacity>
    </>
  ),
}));

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
  {
    id: "e2",
    userId: null,
    name: "Squat",
    muscleGroup: "Gambe",
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
    {
      id: "we2",
      exerciseId: "e2",
      exerciseName: "Squat",
      position: 2,
      notes: null,
      restSeconds: null,
      progressionIncrement: null,
      sets: [
        {
          id: "s2",
          setNumber: 1,
          targetMinReps: 5,
          targetMaxReps: null,
          targetWeight: 80,
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

describe("WorkoutForm — la card con la combobox aperta resta sopra quella successiva", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("alza zIndex/elevation solo della card la cui combobox e' aperta, mai delle altre", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: catalog },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: existingWorkout },
    ]);

    const screen = await renderWithProviders(
      <EditWorkoutScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    await screen.findByLabelText("Nome");
    const openButtons = screen.getAllByLabelText("apri-combobox");
    const closeButtons = screen.getAllByLabelText("chiudi-combobox");
    expect(openButtons).toHaveLength(2);

    function cellZIndex(index: number): number | undefined {
      return StyleSheet.flatten(screen.getByTestId(`exercise-cell-${index}`).props.style).zIndex;
    }

    // Chiuse: nessuna card e' elevata.
    expect(cellZIndex(0)).toBeUndefined();
    expect(cellZIndex(1)).toBeUndefined();

    // Apre la combobox della PRIMA card (quella con un'altra card sotto):
    // senza il fix, la sua tendina verrebbe coperta dalla seconda card —
    // qui si verifica che la card stessa venga elevata sopra quella dopo.
    fireEvent.press(openButtons[0]);
    expect(cellZIndex(0)).toBe(10);
    expect(cellZIndex(1)).toBeUndefined();

    // La chiude: torna al livello normale.
    fireEvent.press(closeButtons[0]);
    expect(cellZIndex(0)).toBeUndefined();
    expect(cellZIndex(1)).toBeUndefined();

    // Apre invece quella della SECONDA card (l'ultima, nulla sotto): tocca
    // a lei essere elevata.
    fireEvent.press(openButtons[1]);
    expect(cellZIndex(0)).toBeUndefined();
    expect(cellZIndex(1)).toBe(10);
  });
});

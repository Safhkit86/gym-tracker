import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses, setDeviceDimensions } from "./helpers";
import { LogSessionScreen } from "../screens/workouts/LogSessionScreen";
import type { WorkoutsStackParamList } from "../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "LogSession">;

function mockNavigation(): Props["navigation"] {
  return { replace: jest.fn(), popTo: jest.fn() } as unknown as Props["navigation"];
}

function mockRoute(id: string): Props["route"] {
  return { params: { id } } as Props["route"];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const workout = {
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
          restMinSeconds: 90,
          restMaxSeconds: null,
          isMaxEffort: false,
        },
      ],
    },
  ],
};

const accountPreferences = {
  prefillScope: "workout",
  timerSoundEnabled: false,
  historicizeMeasurements: false,
};

beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
  await AsyncStorage.clear();
});

describe("LogSessionScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setDeviceDimensions("phone");
  });

  it("precompila dal target scheda e registra la sessione", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
        body: accountPreferences,
      },
      { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "POST",
        body: {
          id: "sess1",
          workoutId: "w1",
          workoutName: "Spinta",
          workoutNotes: null,
          performedAt: new Date().toISOString(),
          notes: null,
          exercises: [],
          createdAt: "",
        },
      },
      {
        match: (u, m) => u.endsWith("/sessions/sess1/status") && m === "GET",
        body: { status: "no-suggestion", suggestions: [] },
      },
    ]);

    const navigation = mockNavigation();
    const screen = await renderWithProviders(
      <LogSessionScreen navigation={navigation} route={mockRoute("w1")} />
    );

    const repsInput = await screen.findByLabelText("Panca piana set 1 rep effettive");
    expect(repsInput.props.value).toBe("8");
    expect(screen.getByLabelText("Panca piana kg effettivi").props.value).toBe("60");
    expect(screen.getByLabelText("Panca piana recupero effettivo").props.value).toBe("90");

    fireEvent.press(screen.getByRole("button", { name: "Registra sessione" }));

    expect(
      await screen.findByText("Nessun suggerimento di progressione questa volta.")
    ).toBeTruthy();

    // popTo (non replace/navigate): WorkoutDetail e' già nello stack sotto
    // LogSessionScreen (raggiunta da "Avvia sessione" in WorkoutDetail) —
    // regressione coperta dopo il bug riportato dall'utente (due "indietro"
    // per uscire dalla scheda invece di uno, vedi LogSessionScreen.tsx).
    fireEvent.press(screen.getByRole("button", { name: "Torna alla scheda" }));
    expect(navigation.popTo).toHaveBeenCalledWith("WorkoutDetail", { id: "w1" });
  });

  it("su tablet in landscape mostra la tabella invece dello stack di card", async () => {
    setDeviceDimensions("tabletLandscape");
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
        body: accountPreferences,
      },
      { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
    ]);

    const screen = await renderWithProviders(
      <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    // "Esercizio" e' l'intestazione di colonna della tabella (session.
    // table.exercise), non presente nella vista a card dello smartphone —
    // la sua presenza distingue in modo affidabile le due viste, dato che
    // gli accessibilityLabel degli input sono condivisi tra le due.
    expect(await screen.findByText("Esercizio")).toBeTruthy();
    expect(screen.getByLabelText("Panca piana set 1 rep effettive").props.value).toBe("8");
  });

  it("disabilita il pulsante timer mentre uno e' gia' attivo", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
        body: accountPreferences,
      },
      { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
    ]);

    const screen = await renderWithProviders(
      <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    await screen.findByLabelText("Panca piana recupero effettivo");
    const startButton = screen.getByRole("button", { name: "Avvia timer recupero" });
    fireEvent.press(startButton);

    expect(await screen.findByText("Panca piana — recupero tra le serie")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Avvia timer recupero" }).props.accessibilityState
    ).toMatchObject({ disabled: true });

    fireEvent.press(screen.getByRole("button", { name: "Elimina" }));

    expect(
      screen.getByRole("button", { name: "Avvia timer recupero" }).props.accessibilityState
        ?.disabled
    ).not.toBe(true);
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "GET",
        status: 404,
        body: { code: "NOT_FOUND", message: "Scheda non trovata." },
      },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
        body: accountPreferences,
      },
      { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
    ]);

    const screen = await renderWithProviders(
      <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Scheda non trovata.");
  });

  describe("bozza locale (rete di sicurezza indipendente dal token)", () => {
    const DRAFT_KEY = "gym-tracker.log-session-draft.w1";

    it("salva una bozza in AsyncStorage mentre si compila il form", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
          body: accountPreferences,
        },
        { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
      ]);

      const screen = await renderWithProviders(
        <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
      );

      const repsInput = await screen.findByLabelText("Panca piana set 1 rep effettive");
      fireEvent.changeText(repsInput, "7");

      await waitFor(async () => {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        expect(raw).not.toBeNull();
        const draft = JSON.parse(raw as string);
        expect(draft.exercises[0].sets[0].actualReps).toBe("7");
      });
    });

    it("ripristina una bozza recente per la stessa scheda, con avviso", async () => {
      await AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          performedAt: "2026-08-01",
          exercises: [
            {
              exerciseId: "e1",
              exerciseName: "Panca piana",
              workoutExerciseId: "we1",
              progressionIncrement: null,
              restSeconds: null,
              targetRestMinSeconds: 90,
              targetRestMaxSeconds: null,
              actualRestSeconds: "95",
              isBodyweight: false,
              actualWeight: "77.5",
              sets: [
                {
                  setNumber: 1,
                  targetMinReps: 8,
                  targetMaxReps: null,
                  isMaxEffort: false,
                  actualReps: "6",
                  targetRestMinSeconds: 90,
                  targetRestMaxSeconds: null,
                },
              ],
            },
          ],
          savedAt: Date.now(),
        })
      );
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
          body: accountPreferences,
        },
        { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
      ]);

      const screen = await renderWithProviders(
        <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
      );

      const repsInput = await screen.findByLabelText("Panca piana set 1 rep effettive");
      expect(repsInput.props.value).toBe("6");
      expect(screen.getByLabelText("Panca piana kg effettivi").props.value).toBe("77.5");
      expect(screen.getByText("Bozza precedente ripristinata.")).toBeTruthy();
    });

    it("'Scarta e ricomincia' torna ai valori di default e svuota la bozza salvata", async () => {
      await AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          performedAt: "2026-08-01",
          exercises: [
            {
              exerciseId: "e1",
              exerciseName: "Panca piana",
              workoutExerciseId: "we1",
              progressionIncrement: null,
              restSeconds: null,
              targetRestMinSeconds: 90,
              targetRestMaxSeconds: null,
              actualRestSeconds: "95",
              isBodyweight: false,
              actualWeight: "77.5",
              sets: [
                {
                  setNumber: 1,
                  targetMinReps: 8,
                  targetMaxReps: null,
                  isMaxEffort: false,
                  actualReps: "6",
                  targetRestMinSeconds: 90,
                  targetRestMaxSeconds: null,
                },
              ],
            },
          ],
          savedAt: Date.now(),
        })
      );
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
          body: accountPreferences,
        },
        { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
      ]);

      const screen = await renderWithProviders(
        <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
      );

      await screen.findByText("Bozza precedente ripristinata.");
      fireEvent.press(screen.getByRole("button", { name: "Scarta e ricomincia" }));

      expect(screen.getByLabelText("Panca piana set 1 rep effettive").props.value).toBe("8");
      expect(screen.queryByText("Bozza precedente ripristinata.")).toBeNull();
      await waitFor(async () => {
        expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
      });
    });

    it("svuota la bozza dopo aver registrato la sessione con successo", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
        { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
          body: accountPreferences,
        },
        { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/sessions") && m === "POST",
          body: {
            id: "sess1",
            workoutId: "w1",
            workoutName: "Spinta",
            workoutNotes: null,
            performedAt: new Date().toISOString(),
            notes: null,
            exercises: [],
            createdAt: "",
          },
        },
        {
          match: (u, m) => u.endsWith("/sessions/sess1/status") && m === "GET",
          body: { status: "no-suggestion", suggestions: [] },
        },
      ]);

      const screen = await renderWithProviders(
        <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
      );

      const repsInput = await screen.findByLabelText("Panca piana set 1 rep effettive");
      fireEvent.changeText(repsInput, "7");
      await waitFor(async () => {
        expect(await AsyncStorage.getItem(DRAFT_KEY)).not.toBeNull();
      });

      fireEvent.press(screen.getByRole("button", { name: "Registra sessione" }));

      await screen.findByText("Nessun suggerimento di progressione questa volta.");
      await waitFor(async () => {
        expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
      });
    });
  });
});

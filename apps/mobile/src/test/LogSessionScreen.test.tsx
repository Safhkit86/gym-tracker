import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
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

    it("il rinnovo periodico del token (useSlidingSession) non ricarica la schermata ne' sovrascrive le modifiche in corso", async () => {
      // Regressione: con un timer di recupero attivo (quindi una sessione
      // lunga abbastanza da attraversare il rinnovo ogni 20 minuti) il
      // vecchio effetto di caricamento dipendeva da "token" e ripartiva ad
      // ogni rinnovo, ricaricando la bozza salvata sopra lo stato corrente
      // — riportato dall'utente come "i controlli degli esercizi
      // spariscono, bisogna scartare la bozza per farli tornare".
      //
      // jest.useFakeTimers() va chiamato PRIMA del render: il setInterval di
      // useSlidingSession si registra al mount, quindi con i timer finti
      // attivati dopo (come in un tentativo precedente di questo test)
      // resterebbe un intervallo reale, mai avanzato da
      // advanceTimersByTimeAsync sotto — nessun rinnovo osservabile entro i
      // tempi del test.
      jest.useFakeTimers();
      try {
        const refreshedUser = { ...fakeUser, id: "u1" };
        const fetchMock = mockFetchResponses([
          { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
          { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workout },
          { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
          {
            match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
            body: accountPreferences,
          },
          { match: (u, m) => u.endsWith("/me/progression-defaults") && m === "GET", body: [] },
          {
            match: (u, m) => u.endsWith("/me/token/refresh") && m === "POST",
            body: { token: "renewed-token", user: refreshedUser },
          },
        ]);

        const screen = await renderWithProviders(
          <LogSessionScreen navigation={mockNavigation()} route={mockRoute("w1")} />
        );
        // Lascia risolvere il Promise.all del caricamento iniziale: sotto
        // fake timers le promise si risolvono comunque normalmente (solo
        // setTimeout/setInterval sono "finti"), basta far girare la coda dei
        // microtask con un avanzamento di 0ms dentro act().
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        const repsInput = screen.getByLabelText("Panca piana set 1 rep effettive");
        fireEvent.changeText(repsInput, "9");
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });
        const draftRaw = await AsyncStorage.getItem(DRAFT_KEY);
        expect(JSON.parse(draftRaw as string).exercises[0].sets[0].actualReps).toBe("9");

        const workoutCallsBefore = fetchMock.mock.calls.filter(([u]) =>
          (u as string).toString().endsWith("/workouts/w1")
        ).length;
        expect(workoutCallsBefore).toBe(1);

        // useSlidingSession rinnova ogni 20 minuti finche' la schermata resta
        // aperta (vedi hooks/useSlidingSession.ts): questo fa scattare
        // AuthProvider.refreshToken, che cambia il valore di "token".
        await act(async () => {
          await jest.advanceTimersByTimeAsync(20 * 60 * 1000);
        });

        expect(
          fetchMock.mock.calls.some(([u]) => (u as string).toString().endsWith("/me/token/refresh"))
        ).toBe(true);

        // Il rinnovo e' avvenuto, ma il form non deve essere stato ricaricato:
        // stesso numero di chiamate a /workouts/w1 di prima, e il valore
        // appena digitato resta quello inserito dall'utente, non quello (piu'
        // vecchio) dell'ultima bozza salvata prima di questa modifica.
        const workoutCallsAfter = fetchMock.mock.calls.filter(([u]) =>
          (u as string).toString().endsWith("/workouts/w1")
        ).length;
        expect(workoutCallsAfter).toBe(workoutCallsBefore);
        expect(screen.getByLabelText("Panca piana set 1 rep effettive").props.value).toBe("9");
      } finally {
        jest.useRealTimers();
      }
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

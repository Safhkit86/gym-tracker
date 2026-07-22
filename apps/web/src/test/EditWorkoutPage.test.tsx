import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { EditWorkoutPage } from "../pages/EditWorkoutPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };
const FAKE_EXERCISE = {
  id: "e1",
  ownerId: null,
  name: "Panca piana",
  muscleGroup: "Petto",
  description: "Sdraiati sulla panca e spingi il bilanciere verso l'alto.",
  sourceUrl: null,
};
const FAKE_EXERCISE_2 = {
  id: "e2",
  ownerId: null,
  name: "Squat",
  muscleGroup: "Gambe",
  description: null,
  sourceUrl: null,
};

const WORKOUT_DETAIL = {
  id: "w1",
  name: "Push day",
  notes: "Focus petto",
  exercises: [
    {
      id: "we1",
      exerciseId: "e1",
      exerciseName: "Panca piana",
      position: 1,
      notes: null,
      restSeconds: 120,
      progressionIncrement: 2.5,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 10,
          targetMaxReps: null,
          targetWeight: 40,
          restMinSeconds: 60,
          restMaxSeconds: 90,
        },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderEditPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/workouts/:id/edit" element={<EditWorkoutPage />} />
    </Routes>,
    ["/workouts/w1/edit"]
  );
}

describe("EditWorkoutPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-popola il form con i valori della scheda esistente", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
    ]);

    renderEditPage();

    expect(await screen.findByLabelText("Nome")).toHaveValue("Push day");
    expect(screen.getByLabelText("Note")).toHaveValue("Focus petto");
    expect(screen.getByLabelText("Rep minime")).toHaveValue(10);
    expect(screen.getByLabelText("Peso (kg)")).toHaveValue(40);
    expect(screen.getByLabelText("Recupero minimo (s)")).toHaveValue(60);
    expect(screen.getByLabelText("Recupero massimo (s) (opzionale)")).toHaveValue(90);
    expect(screen.getByLabelText(/recupero prima del prossimo esercizio/i)).toHaveValue(120);
    expect(screen.getByLabelText(/incremento di progressione/i)).toHaveValue(2.5);
  });

  it("converte i campi null della scheda esistente in stringa vuota", async () => {
    const workoutWithNulls = {
      ...WORKOUT_DETAIL,
      exercises: [
        {
          ...WORKOUT_DETAIL.exercises[0],
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              id: "s1",
              setNumber: 1,
              targetMinReps: 10,
              targetMaxReps: null,
              targetWeight: null,
              restMinSeconds: null,
              restMaxSeconds: null,
            },
          ],
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: workoutWithNulls },
    ]);

    renderEditPage();

    await screen.findByLabelText("Nome");
    expect(screen.getByLabelText("Peso (kg)")).toHaveValue(null);
    expect(screen.getByLabelText("Recupero minimo (s)")).toHaveValue(null);
    expect(screen.getByLabelText("Recupero massimo (s) (opzionale)")).toHaveValue(null);
    expect(screen.getByLabelText(/recupero prima del prossimo esercizio/i)).toHaveValue(null);
    expect(screen.getByLabelText(/incremento di progressione/i)).toHaveValue(null);
  });

  it("invia PUT con i valori invariati ricostruiti dal form", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT",
        body: WORKOUT_DETAIL,
      },
    ]);

    renderEditPage();

    await screen.findByLabelText("Nome");
    fireEvent.click(screen.getByRole("button", { name: /salva modifiche/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(putCall).toBeDefined();
    });

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}");
    expect(body).toMatchObject({
      name: "Push day",
      notes: "Focus petto",
      exercises: [
        {
          exerciseId: "e1",
          position: 1,
          restSeconds: 120,
          progressionIncrement: 2.5,
          sets: [
            {
              setNumber: 1,
              targetMinReps: 10,
              targetWeight: 40,
              restMinSeconds: 60,
              restMaxSeconds: 90,
            },
          ],
        },
      ],
    });
  });

  it("modificare un campo preserva gli altri valori invariati nel body inviato", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT", body: WORKOUT_DETAIL },
    ]);

    renderEditPage();

    await screen.findByLabelText("Nome");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day v2" } });
    fireEvent.click(screen.getByRole("button", { name: /salva modifiche/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(putCall).toBeDefined();
    });

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}");
    expect(body.name).toBe("Push day v2");
    expect(body.exercises[0].sets[0]).toMatchObject({ setNumber: 1, targetMinReps: 10 });
  });

  it("rimuovere un esercizio ri-deriva le posizioni senza buchi", async () => {
    const twoExerciseWorkout = {
      ...WORKOUT_DETAIL,
      exercises: [
        WORKOUT_DETAIL.exercises[0],
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
              targetMinReps: 8,
              targetMaxReps: null,
              targetWeight: 60,
              restMinSeconds: null,
              restMaxSeconds: null,
            },
          ],
        },
      ],
    };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/exercises") && m === "GET",
        body: [FAKE_EXERCISE, FAKE_EXERCISE_2],
      },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: twoExerciseWorkout },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT", body: twoExerciseWorkout },
    ]);

    renderEditPage();

    await screen.findByText("Esercizio 2");
    fireEvent.click(screen.getAllByRole("button", { name: /rimuovi esercizio/i })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^sì$/i }));
    fireEvent.click(screen.getByRole("button", { name: /salva modifiche/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(putCall).toBeDefined();
    });

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}");
    expect(body.exercises).toHaveLength(1);
    expect(body.exercises[0]).toMatchObject({ exerciseId: "e2", position: 1 });
  });

  it("aggiungere un set incrementa correttamente il numero di set inviato", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT", body: WORKOUT_DETAIL },
    ]);

    renderEditPage();

    await screen.findByLabelText("Nome");
    fireEvent.click(screen.getByRole("button", { name: /aggiungi set/i }));
    const repsInputs = screen.getAllByLabelText("Rep minime");
    fireEvent.change(repsInputs[1], { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /salva modifiche/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(putCall).toBeDefined();
    });

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}");
    expect(body.exercises[0].sets).toEqual([
      {
        setNumber: 1,
        targetMinReps: 10,
        targetWeight: 40,
        restMinSeconds: 60,
        restMaxSeconds: 90,
        isMaxEffort: false,
      },
      { setNumber: 2, targetMinReps: 8, isMaxEffort: false },
    ]);
  });
});

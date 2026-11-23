import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { CreateWorkoutPage } from "../pages/CreateWorkoutPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };
const FAKE_EXERCISE = {
  id: "e1",
  userId: null,
  name: "Panca piana",
  muscleGroup: "Petto",
  description: "Sdraiati sulla panca e spingi il bilanciere verso l'alto.",
  sourceUrl: null,
};
const FAKE_EXERCISE_2 = {
  id: "e2",
  userId: null,
  name: "Squat",
  muscleGroup: "Gambe",
  description: null,
  sourceUrl: null,
};

describe("CreateWorkoutPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invia la scheda con posizioni e numeri di set derivati dall'ordine", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 201,
        body: {
          id: "w1",
          name: "Push day",
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText("Rep minime"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    expect(body).toMatchObject({
      name: "Push day",
      exercises: [
        {
          exerciseId: "e1",
          position: 1,
          sets: [{ setNumber: 1, targetMinReps: 10 }],
        },
      ],
    });
  });

  it("bordare di rosso solo i campi rep minime/massime segnalati dal server come non validi", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 400,
        body: {
          code: "VALIDATION_ERROR",
          message: "Le rep massime devono essere maggiori o uguali alle rep minime.",
          details: {
            issues: [{ path: "exercises.0.sets.0._repsRange", message: "Le rep massime..." }],
          },
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText("Rep minime"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Rep massime (opzionale)"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    expect(
      await screen.findByText("Le rep massime devono essere maggiori o uguali alle rep minime.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rep minime")).toHaveClass("invalid");
    expect(screen.getByLabelText("Rep massime (opzionale)")).toHaveClass("invalid");
    expect(screen.getByLabelText("Nome")).not.toHaveClass("invalid");
    expect(screen.getByLabelText("Peso (kg)")).not.toHaveClass("invalid");
    expect(screen.getByLabelText("Recupero minimo (s)")).not.toHaveClass("invalid");
    expect(screen.getByLabelText("Recupero massimo (s) (opzionale)")).not.toHaveClass("invalid");
  });

  it("bordare di rosso solo i campi recupero minimo/massimo segnalati dal server come non validi", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 400,
        body: {
          code: "VALIDATION_ERROR",
          message:
            "Il recupero massimo richiede anche il minimo, e deve essere maggiore o uguale ad esso.",
          details: {
            issues: [{ path: "exercises.0.sets.0._restRange", message: "Il recupero massimo..." }],
          },
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText("Rep minime"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Recupero minimo (s)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Recupero massimo (s) (opzionale)"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    expect(
      await screen.findByText(
        "Il recupero massimo richiede anche il minimo, e deve essere maggiore o uguale ad esso."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Recupero minimo (s)")).toHaveClass("invalid");
    expect(screen.getByLabelText("Recupero massimo (s) (opzionale)")).toHaveClass("invalid");
    expect(screen.getByLabelText("Rep minime")).not.toHaveClass("invalid");
    expect(screen.getByLabelText("Nome")).not.toHaveClass("invalid");
  });

  it("selezionando 'Max sforzo (AMRAP)' nasconde rep minime/massime e non le invia", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 201,
        body: {
          id: "w1",
          name: "Push day",
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Trazioni day" } });
    expect(screen.getByLabelText("Rep minime")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Max sforzo (AMRAP)"));
    expect(screen.queryByLabelText("Rep minime")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rep massime (opzionale)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    const sentSet = body.exercises[0].sets[0];
    expect(sentSet.isMaxEffort).toBe(true);
    expect(sentSet.targetMinReps).toBeUndefined();
    expect(sentSet.targetMaxReps).toBeUndefined();
  });

  it("mostra la descrizione dell'esercizio selezionato e raggruppa il catalogo per gruppo muscolare", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/exercises") && m === "GET",
        body: [FAKE_EXERCISE, FAKE_EXERCISE_2],
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    const exerciseField = await screen.findByLabelText("Esercizio");
    expect(screen.getByText(/spingi il bilanciere/i)).toBeInTheDocument();

    // I gruppi per muscolo sono nella lista a comparsa: visibili solo dopo
    // aver aperto il campo di ricerca (vedi ExerciseCombobox).
    fireEvent.focus(exerciseField);
    expect(screen.getByRole("group", { name: "Petto" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Gambe" })).toBeInTheDocument();
  });

  it("filtra il catalogo per nome nel campo di ricerca esercizio e permette di scegliere un risultato", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/exercises") && m === "GET",
        body: [FAKE_EXERCISE, FAKE_EXERCISE_2],
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    const exerciseField = await screen.findByLabelText("Esercizio");
    fireEvent.focus(exerciseField);
    fireEvent.change(exerciseField, { target: { value: "squat" } });

    expect(screen.getByRole("option", { name: "Squat" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Panca piana" })).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("option", { name: "Squat" }));

    expect(exerciseField).toHaveValue("Squat");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("duplica l'ultimo set con gli stessi valori", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Rep minime"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /duplica ultimo set/i }));

    const repsInputs = screen.getAllByLabelText("Rep minime") as HTMLInputElement[];
    expect(repsInputs).toHaveLength(2);
    expect(repsInputs[1].value).toBe("10");
    const weightInputs = screen.getAllByLabelText("Peso (kg)") as HTMLInputElement[];
    expect(weightInputs[1].value).toBe("40");
  });

  it("invia il recupero tra esercizi impostato dall'utente", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 201,
        body: {
          id: "w1",
          name: "Push day",
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText("Rep minime"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/recupero prima del prossimo esercizio/i), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    expect(body.exercises[0].restSeconds).toBe(120);
  });

  it("invia l'incremento di progressione impostato dall'utente", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 201,
        body: {
          id: "w1",
          name: "Push day",
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day" } });
    fireEvent.change(screen.getByLabelText("Rep minime"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/incremento di progressione/i), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    expect(body.exercises[0].progressionIncrement).toBe(2.5);
  });

  it("chiede conferma prima di rimuovere un esercizio e annulla su 'No'", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/exercises") && m === "GET",
        body: [FAKE_EXERCISE, FAKE_EXERCISE_2],
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.click(screen.getByRole("button", { name: /aggiungi esercizio/i }));
    expect(screen.getAllByText(/^Esercizio \d$/)).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: /rimuovi esercizio/i })[0]);
    expect(
      await screen.findByText("Sei sicuro di voler eliminare l'esercizio?")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));

    expect(
      screen.queryByText("Sei sicuro di voler eliminare l'esercizio?")
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Esercizio \d$/)).toHaveLength(2);
  });

  it("rimuove l'esercizio dopo la conferma con 'Sì'", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/exercises") && m === "GET",
        body: [FAKE_EXERCISE, FAKE_EXERCISE_2],
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.click(screen.getByRole("button", { name: /aggiungi esercizio/i }));
    expect(screen.getAllByText(/^Esercizio \d$/)).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: /rimuovi esercizio/i })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^sì$/i }));

    expect(screen.getAllByText(/^Esercizio \d$/)).toHaveLength(1);
  });

  it("raggruppa due esercizi in un superset e li invia con lo stesso supersetGroupId", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 201,
        body: {
          id: "w1",
          name: "Push day",
          notes: null,
          exercises: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Push day" } });
    fireEvent.click(screen.getByRole("button", { name: /aggiungi esercizio/i }));
    const repsInputs = screen.getAllByLabelText("Rep minime");
    fireEvent.change(repsInputs[0], { target: { value: "10" } });
    fireEvent.change(repsInputs[1], { target: { value: "8" } });
    fireEvent.change(screen.getAllByLabelText(/recupero prima del prossimo esercizio/i)[1], {
      target: { value: "90" },
    });

    fireEvent.click(screen.getByRole("button", { name: /raggruppa esercizi/i }));
    const checkboxes = screen.getAllByLabelText("Seleziona per il superset");
    expect(checkboxes).toHaveLength(2);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /crea superset/i }));

    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /separa superset/i })).toHaveLength(2);
    // Il primo esercizio del gruppo non ha piu' il campo di riposo (nessuna
    // pausa tra gli esercizi dello stesso giro), il secondo (ultimo) lo
    // mantiene.
    expect(screen.getByText("Nessun riposo: fa parte di un superset.")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/recupero prima del prossimo esercizio/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /crea scheda/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1]?.body as string) ?? "{}");
    expect(body.exercises[0].supersetGroupId).toBeTruthy();
    expect(body.exercises[0].supersetGroupId).toBe(body.exercises[1].supersetGroupId);
    expect(body.exercises[0].restSeconds).toBeUndefined();
    expect(body.exercises[1].restSeconds).toBe(90);
  });

  it("separa un superset esistente", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.click(screen.getByRole("button", { name: /aggiungi esercizio/i }));
    fireEvent.click(screen.getByRole("button", { name: /raggruppa esercizi/i }));
    const checkboxes = screen.getAllByLabelText("Seleziona per il superset");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /crea superset/i }));
    expect(screen.getByText("A1")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /separa superset/i })[0]);

    expect(screen.queryByText("A1")).not.toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /separa superset/i })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/recupero prima del prossimo esercizio/i)).toHaveLength(2);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { CreateWorkoutPage } from "../pages/CreateWorkoutPage";

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
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "10" } });
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
          sets: [{ setNumber: 1, targetReps: 10 }],
        },
      ],
    });
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

    await screen.findByLabelText("Esercizio");
    expect(screen.getByText(/spingi il bilanciere/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Petto" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Gambe" })).toBeInTheDocument();
  });

  it("duplica l'ultimo set con gli stessi valori", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [FAKE_EXERCISE] },
    ]);

    renderWithProviders(<CreateWorkoutPage />, ["/workouts/new"]);

    await screen.findByLabelText("Esercizio");
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /duplica ultimo set/i }));

    const repsInputs = screen.getAllByLabelText("Reps") as HTMLInputElement[];
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
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "10" } });
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
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "10" } });
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
});

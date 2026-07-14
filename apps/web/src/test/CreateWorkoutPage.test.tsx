import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { CreateWorkoutPage } from "../pages/CreateWorkoutPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };
const FAKE_EXERCISE = { id: "e1", ownerId: null, name: "Panca piana", muscleGroup: "Petto" };

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
});

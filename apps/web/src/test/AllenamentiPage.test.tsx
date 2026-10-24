import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { AllenamentiPage } from "../pages/AllenamentiPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const ALLENAMENTO_1 = {
  id: "a1",
  name: "Massa",
  isActive: true,
  workoutCount: 1,
  createdAt: "",
  updatedAt: "",
};

const ALLENAMENTO_2 = {
  id: "a2",
  name: "Definizione",
  isActive: false,
  workoutCount: 0,
  createdAt: "",
  updatedAt: "",
};

const WORKOUT_A1 = {
  id: "w1",
  name: "Push day",
  notes: null,
  allenamentoId: "a1",
  exerciseCount: 2,
  createdAt: "",
  updatedAt: "",
};

describe("AllenamentiPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  it("elenca gli allenamenti con stato attivo e le schede assegnate", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "GET",
        body: [ALLENAMENTO_1, ALLENAMENTO_2],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET",
        body: [WORKOUT_A1],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a2") && m === "GET",
        body: [],
      },
    ]);

    renderWithProviders(<AllenamentiPage />, ["/allenamenti"]);

    expect(await screen.findByText("Massa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /definizione/i })).toBeInTheDocument();
    expect(screen.getByText("Attivo")).toBeInTheDocument();
    expect(screen.getByText("Push day")).toBeInTheDocument();
  });

  it("crea un nuovo allenamento", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/allenamenti") && m === "GET", body: [ALLENAMENTO_1] },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET",
        body: [],
      },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "POST",
        body: ALLENAMENTO_2,
        status: 201,
      },
    ]);

    renderWithProviders(<AllenamentiPage />, ["/allenamenti"]);
    await screen.findByText("Massa");

    fireEvent.click(screen.getByRole("button", { name: /nuovo allenamento/i }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Definizione" } });
    fireEvent.click(screen.getByRole("button", { name: "Sì" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([u, init]) => String(u).endsWith("/allenamenti") && init?.method === "POST"
        )
      ).toBe(true);
    });
  });

  it("attiva un allenamento non attivo", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "GET",
        body: [ALLENAMENTO_1, ALLENAMENTO_2],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=") && m === "GET",
        body: [],
      },
      {
        match: (u, m) => u.endsWith("/allenamenti/a2") && m === "PATCH",
        body: { ...ALLENAMENTO_2, isActive: true },
      },
    ]);

    renderWithProviders(<AllenamentiPage />, ["/allenamenti"]);
    await screen.findByText("Definizione");

    fireEvent.click(screen.getByRole("button", { name: "Rendi attivo" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, init]) => String(u).endsWith("/allenamenti/a2") && init?.method === "PATCH"
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call?.[1]?.body as string) ?? "{}")).toEqual({ isActive: true });
    });
  });

  it("mostra l'errore del server se l'eliminazione e' bloccata (es. allenamento attivo)", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/allenamenti") && m === "GET", body: [ALLENAMENTO_1] },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET",
        body: [],
      },
      {
        match: (u, m) => u.endsWith("/allenamenti/a1") && m === "DELETE",
        status: 409,
        body: {
          code: "ALLENAMENTO_IS_ACTIVE",
          message: "Non puoi eliminare l'allenamento attivo: rendine attivo un altro prima.",
        },
      },
    ]);

    renderWithProviders(<AllenamentiPage />, ["/allenamenti"]);
    await screen.findByText("Massa");

    fireEvent.click(screen.getByRole("button", { name: "Elimina allenamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sì" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Non puoi eliminare l'allenamento attivo"
    );
  });

  it("sposta una scheda in un altro allenamento", async () => {
    const WORKOUT_DETAIL = {
      id: "w1",
      name: "Push day",
      notes: null,
      allenamentoId: "a1",
      exercises: [],
      createdAt: "",
      updatedAt: "",
    };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "GET",
        body: [ALLENAMENTO_1, ALLENAMENTO_2],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET",
        body: [WORKOUT_A1],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a2") && m === "GET",
        body: [],
      },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT",
        body: { ...WORKOUT_DETAIL, allenamentoId: "a2" },
      },
    ]);

    renderWithProviders(<AllenamentiPage />, ["/allenamenti"]);
    await screen.findByText("Push day");

    fireEvent.change(screen.getByLabelText('Sposta "Push day" in un altro allenamento'), {
      target: { value: "a2" },
    });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, init]) => String(u).endsWith("/workouts/w1") && init?.method === "PUT"
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call?.[1]?.body as string) ?? "{}")).toMatchObject({
        allenamentoId: "a2",
      });
    });
  });
});

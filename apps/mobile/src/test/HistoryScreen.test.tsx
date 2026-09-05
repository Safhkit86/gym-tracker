import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithProviders, mockFetchResponses, setDeviceDimensions } from "./helpers";
import { HistoryScreen } from "../screens/history/HistoryScreen";
import type { Props as HistoryScreenProps } from "../screens/history/HistoryScreen";

/** addListener("focus", ...) (useRefreshOnFocus) e' l'unico metodo che
 *  questa schermata usa da `navigation` — vedi HistoryScreen.tsx. */
function mockNavigation(): HistoryScreenProps["navigation"] {
  return { addListener: jest.fn(() => jest.fn()) } as unknown as HistoryScreenProps["navigation"];
}

function mockRoute(): HistoryScreenProps["route"] {
  return {} as HistoryScreenProps["route"];
}

/** La schermata fa ora anche una GET paginata "/sessions?page=&pageSize=..."
 *  (card mostrate a schermo), oltre a quella semplice (numerazione
 *  settimane) — vedi HistoryScreen.tsx e sessionsHandlers in
 *  SessionHistoryPage.test.tsx (webapp) per lo stesso schema. */
function sessionsHandlers(items: unknown[]) {
  return [
    { match: (u: string, m: string) => u.endsWith("/sessions") && m === "GET", body: items },
    {
      match: (u: string, m: string) => u.includes("/sessions?") && m === "GET",
      body: { items, total: items.length, page: 1, pageSize: 20 },
    },
  ];
}

function measurementsHandlers(items: unknown[]) {
  return [
    { match: (u: string, m: string) => u.endsWith("/measurements") && m === "GET", body: items },
    {
      match: (u: string, m: string) => u.includes("/measurements?") && m === "GET",
      body: { items, total: items.length, page: 1, pageSize: 20 },
    },
  ];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const session = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Spinta",
  workoutNotes: null,
  performedAt: "2026-08-01T10:00:00.000Z",
  notes: null,
  createdAt: "",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: null,
      restSeconds: 90,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: 10,
          actualReps: 9,
          actualWeight: 60,
          actualRpe: null,
          targetRestMinSeconds: 90,
          targetRestMaxSeconds: null,
          actualRestSeconds: 90,
        },
      ],
    },
  ],
};

const measurementNew = {
  id: "m1",
  measuredOn: "2026-08-01",
  weightKg: 79,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
  createdAt: "",
  updatedAt: "",
};

const measurementOld = {
  id: "m2",
  measuredOn: "2026-07-01",
  weightKg: 80,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
  createdAt: "",
  updatedAt: "",
};

beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("HistoryScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setDeviceDimensions("phone");
  });

  it("su tablet mostra la sessione in tabella (Esercizio · Set · Kg · Recupero)", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      ...sessionsHandlers([session]),
    ]);

    setDeviceDimensions("tabletLandscape");
    const screen = await renderWithProviders(
      <HistoryScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    expect(await screen.findByText("Spinta")).toBeTruthy();
    expect(screen.getByText("Esercizio")).toBeTruthy();
    expect(screen.getByText("Panca piana")).toBeTruthy();
    expect(screen.getByText("60 kg")).toBeTruthy();
    expect(screen.getByText("90s")).toBeTruthy();
  });

  it("mostra le sessioni ed elimina dopo conferma", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });

    // Mock manuale (non mockFetchResponses) perche' qui serve stato: dopo la
    // DELETE, il refetch paginato che segue l'eliminazione (loadSessionsPage)
    // deve riflettere la lista vuota, non la sessione "cancellata" di un
    // mock statico — stesso motivo del mock manuale in
    // NotificationsPage.test.tsx (webapp).
    let deleted = false;
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      const jsonResponse = (body: unknown, status = 200) => ({
        ok: status < 300,
        status,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
      });
      if (url.endsWith("/me") && method === "GET") {
        return jsonResponse(fakeUser);
      }
      if (url.endsWith("/sessions/sess1") && method === "DELETE") {
        deleted = true;
        return jsonResponse(undefined, 204);
      }
      if (url.includes("/sessions?") && method === "GET") {
        const items = deleted ? [] : [session];
        return jsonResponse({ items, total: items.length, page: 1, pageSize: 20 });
      }
      if (url.endsWith("/sessions") && method === "GET") {
        return jsonResponse(deleted ? [] : [session]);
      }
      throw new Error(`Nessun handler mockato per ${method} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const screen = await renderWithProviders(
      <HistoryScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    expect(await screen.findByText("Spinta")).toBeTruthy();
    expect(screen.getByText("Panca piana")).toBeTruthy();
    expect(screen.getByText("60 kg")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Elimina sessione" }));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/sess1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Spinta")).toBeNull();
    });
  });

  it("mostra un errore se il caricamento sessioni fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.includes("/sessions") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(
      <HistoryScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });

  it("carica le misure solo al primo tocco sul tab e mostra il delta", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      ...sessionsHandlers([]),
      ...measurementsHandlers([measurementNew, measurementOld]),
    ]);

    const screen = await renderWithProviders(
      <HistoryScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    await screen.findByText("Non hai ancora registrato nessuna sessione.");
    fireEvent.press(screen.getByRole("button", { name: "Misure" }));

    expect(await screen.findByText("79 kg")).toBeTruthy();
    expect(screen.getByText("▼ 1")).toBeTruthy();
  });

  it("mostra i controlli di paginazione e richiede la pagina successiva al tocco", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [session] },
      {
        match: (u, m) => u.includes("/sessions?") && u.includes("page=2") && m === "GET",
        body: { items: [], total: 21, page: 2, pageSize: 20 },
      },
      {
        match: (u, m) => u.includes("/sessions?") && m === "GET",
        body: { items: [session], total: 21, page: 1, pageSize: 20 },
      },
    ]);

    const screen = await renderWithProviders(
      <HistoryScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    await screen.findByText("Pagina 1 di 2");

    fireEvent.press(screen.getByRole("button", { name: "Successiva →" }));

    await screen.findByText("Pagina 2 di 2");
    expect(
      fetchMock.mock.calls.some(([url]) => (url as string).toString().includes("/sessions?page=2"))
    ).toBe(true);
  });

  it("un filtro rapido periodo richiede la lista con il parametro since", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      ...sessionsHandlers([session]),
    ]);

    const screen = await renderWithProviders(
      <HistoryScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    await screen.findByText("Spinta");
    fireEvent.press(screen.getByRole("button", { name: "1M" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url]) =>
            (url as string).toString().includes("/sessions?") &&
            (url as string).toString().includes("since=")
        )
      ).toBe(true);
    });
  });
});

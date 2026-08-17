import * as SecureStore from "expo-secure-store";
import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import type { NotificationsStackParamList } from "../navigation/NotificationsNavigator";

type Props = NativeStackScreenProps<NotificationsStackParamList, "NotificationsHome">;

/** addListener("focus", ...) e' l'unico metodo di navigation che questa
 *  schermata usa (per rifare il fetch al ritorno in primo piano, vedi
 *  NotificationsScreen.tsx) — il ritorno (funzione di unsubscribe) non
 *  viene mai chiamato nei test qui sotto, che non simulano un cambio di
 *  focus reale. */
function mockNavigation(): Props["navigation"] {
  return { addListener: jest.fn(() => jest.fn()) } as unknown as Props["navigation"];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const unreadNotification = {
  id: "n1",
  exerciseId: "e1",
  exerciseName: "Panca piana",
  suggestionType: "increase_weight" as const,
  previousValue: 50,
  suggestedValue: 52.5,
  reason: "3 sessioni consecutive nel range massimo.",
  triggeringSessionId: "sess1",
  readAt: null,
  createdAt: "2026-08-01T10:00:00.000Z",
};

const readNotification = {
  id: "n2",
  exerciseId: "e2",
  exerciseName: "Squat",
  suggestionType: "increase_reps" as const,
  previousValue: 8,
  suggestedValue: 9,
  reason: "3 sessioni consecutive nel range massimo.",
  triggeringSessionId: "sess0",
  readAt: "2026-07-30T10:00:00.000Z",
  createdAt: "2026-07-29T10:00:00.000Z",
};

function baseHandlers(allNotifications: unknown[]) {
  return [
    { match: (u: string, m: string) => u.endsWith("/me") && m === "GET", body: fakeUser },
    {
      match: (u: string, m: string) =>
        u.endsWith("/notifications") && !u.includes("unread") && m === "GET",
      body: allNotifications,
    },
    {
      match: (u: string, m: string) =>
        u.includes("/notifications") && u.includes("unread=true") && m === "GET",
      body: allNotifications.filter(
        (n): n is { readAt: null } => (n as { readAt: string | null }).readAt === null
      ),
    },
  ];
}

describe("NotificationsScreen", () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra le notifiche lette e non lette e permette di segnare come letta", async () => {
    const fetchMock = mockFetchResponses([
      ...baseHandlers([unreadNotification, readNotification]),
      {
        match: (u: string, m: string) => u.endsWith("/notifications/n1/read") && m === "PATCH",
        body: undefined,
      },
    ]);

    const screen = await renderWithProviders(
      <NotificationsScreen navigation={mockNavigation()} route={{} as Props["route"]} />
    );

    expect(await screen.findByText("Panca piana")).toBeTruthy();
    expect(screen.getByText("Squat")).toBeTruthy();
    expect(screen.getByText("50kg → 52.5kg")).toBeTruthy();
    // "Squat" e' gia' letta: un solo pulsante "Segna come letta", non due.
    expect(screen.getAllByRole("button", { name: "Segna come letta" }).length).toBe(1);

    fireEvent.press(screen.getByRole("button", { name: "Segna come letta" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/n1/read"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("mostra un errore se il caricamento fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/notifications") && !u.includes("unread") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
      {
        match: (u, m) => u.includes("/notifications") && u.includes("unread=true") && m === "GET",
        body: [],
      },
    ]);

    const screen = await renderWithProviders(
      <NotificationsScreen navigation={mockNavigation()} route={{} as Props["route"]} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });

  it("accetta tutte le progressioni pendenti e segna tutte come lette", async () => {
    const fetchMock = mockFetchResponses([
      ...baseHandlers([unreadNotification, readNotification]),
      {
        match: (u: string, m: string) => u.endsWith("/me/progression-defaults") && m === "POST",
        body: undefined,
      },
      {
        match: (u: string, m: string) => u.endsWith("/notifications/read-all") && m === "POST",
        body: { count: 1 },
      },
    ]);

    const screen = await renderWithProviders(
      <NotificationsScreen navigation={mockNavigation()} route={{} as Props["route"]} />
    );

    await screen.findByText("Panca piana");
    fireEvent.press(screen.getByRole("button", { name: "Accetta tutte le progressioni" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/me/progression-defaults"),
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/read-all"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

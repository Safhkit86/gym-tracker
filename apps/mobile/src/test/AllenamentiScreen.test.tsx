import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { AllenamentiScreen } from "../screens/workouts/AllenamentiScreen";
import type { WorkoutsStackParamList } from "../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "Allenamenti">;

function mockNavigation(): Props["navigation"] {
  return {
    navigate: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  } as unknown as Props["navigation"];
}

function mockRoute(): Props["route"] {
  return {} as Props["route"];
}

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

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

beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("AllenamentiScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("elenca gli allenamenti con stato attivo e le schede assegnate", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "GET",
        body: [ALLENAMENTO_1, ALLENAMENTO_2],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET",
        body: [WORKOUT_A1],
      },
      { match: (u, m) => u.includes("/workouts?allenamentoId=a2") && m === "GET", body: [] },
    ]);

    const screen = await renderWithProviders(
      <AllenamentiScreen navigation={mockNavigation()} route={mockRoute()} />
    );

    expect(await screen.findByText("Massa")).toBeTruthy();
    expect(screen.getByText("Definizione")).toBeTruthy();
    expect(screen.getByText("Attivo")).toBeTruthy();
    expect(screen.getByText("Push day")).toBeTruthy();
  });

  it("crea un nuovo allenamento", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/allenamenti") && m === "GET", body: [ALLENAMENTO_1] },
      { match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "POST",
        body: ALLENAMENTO_2,
        status: 201,
      },
    ]);

    const screen = await renderWithProviders(
      <AllenamentiScreen navigation={mockNavigation()} route={mockRoute()} />
    );
    await screen.findByText("Massa");

    fireEvent.press(screen.getByRole("button", { name: "Nuovo allenamento" }));
    fireEvent.changeText(screen.getByLabelText("Nome"), "Definizione");
    fireEvent.press(screen.getByRole("button", { name: "Sì" }));

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
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "GET",
        body: [ALLENAMENTO_1, ALLENAMENTO_2],
      },
      { match: (u, m) => u.includes("/workouts?allenamentoId=") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/allenamenti/a2") && m === "PATCH",
        body: { ...ALLENAMENTO_2, isActive: true },
      },
    ]);

    const screen = await renderWithProviders(
      <AllenamentiScreen navigation={mockNavigation()} route={mockRoute()} />
    );
    await screen.findByText("Definizione");

    fireEvent.press(screen.getByRole("button", { name: "Rendi attivo" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, init]) => String(u).endsWith("/allenamenti/a2") && init?.method === "PATCH"
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call?.[1]?.body as string) ?? "{}")).toEqual({ isActive: true });
    });
  });

  it("mostra l'errore del server se l'eliminazione e' bloccata (es. allenamento attivo)", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      const confirmButton = buttons?.find((b) => b.style === "destructive");
      confirmButton?.onPress?.();
    });

    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/allenamenti") && m === "GET", body: [ALLENAMENTO_1] },
      { match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/allenamenti/a1") && m === "DELETE",
        status: 409,
        body: {
          code: "ALLENAMENTO_IS_ACTIVE",
          message: "Non puoi eliminare l'allenamento attivo: rendine attivo un altro prima.",
        },
      },
    ]);

    const screen = await renderWithProviders(
      <AllenamentiScreen navigation={mockNavigation()} route={mockRoute()} />
    );
    await screen.findByText("Massa");

    fireEvent.press(screen.getByRole("button", { name: "Elimina allenamento" }));

    expect(alertSpy).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Non puoi eliminare l'allenamento attivo: rendine attivo un altro prima."
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
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/allenamenti") && m === "GET",
        body: [ALLENAMENTO_1, ALLENAMENTO_2],
      },
      {
        match: (u, m) => u.includes("/workouts?allenamentoId=a1") && m === "GET",
        body: [WORKOUT_A1],
      },
      { match: (u, m) => u.includes("/workouts?allenamentoId=a2") && m === "GET", body: [] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      {
        match: (u, m) => u.endsWith("/workouts/w1") && m === "PUT",
        body: { ...WORKOUT_DETAIL, allenamentoId: "a2" },
      },
    ]);

    const screen = await renderWithProviders(
      <AllenamentiScreen navigation={mockNavigation()} route={mockRoute()} />
    );
    await screen.findByText("Push day");

    fireEvent.press(screen.getByRole("button", { name: "Sposta in…" }));
    fireEvent.press(await screen.findByRole("button", { name: "Definizione" }));

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

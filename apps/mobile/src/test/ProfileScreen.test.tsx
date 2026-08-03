import * as SecureStore from "expo-secure-store";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { ProfileScreen } from "../screens/profile/ProfileScreen";

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const measurements = {
  heightCm: 180,
  weightKg: 80,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
};

const progressionPreferences = {
  requiredConsecutiveSessions: 2,
  groupingScope: "workout" as const,
};

const accountPreferences = {
  prefillScope: "workout" as const,
  timerSoundEnabled: false,
  historicizeMeasurements: true,
};

function baseHandlers() {
  return [
    { match: (u: string, m: string) => u.endsWith("/me") && m === "GET", body: fakeUser },
    {
      match: (u: string, m: string) => u.endsWith("/me/measurements") && m === "GET",
      body: measurements,
    },
    {
      match: (u: string, m: string) => u.endsWith("/me/preferences") && m === "GET",
      body: progressionPreferences,
    },
    {
      match: (u: string, m: string) => u.endsWith("/me/account-preferences") && m === "GET",
      body: accountPreferences,
    },
  ];
}

describe("ProfileScreen", () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("precompila le misure e salva le modifiche", async () => {
    const fetchMock = mockFetchResponses([
      ...baseHandlers(),
      {
        match: (u: string, m: string) => u.endsWith("/me/measurements") && m === "PUT",
        body: { ...measurements, weightKg: 81 },
      },
      {
        match: (u: string, m: string) => u.endsWith("/me/account-preferences") && m === "PUT",
        body: accountPreferences,
      },
    ]);

    const screen = await renderWithProviders(<ProfileScreen />);

    const weightInput = await screen.findByDisplayValue("80");
    fireEvent.changeText(weightInput, "81");
    fireEvent.press(screen.getByRole("button", { name: "Salva misure" }));

    expect(await screen.findByText(/Misure salvate per il/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/me/measurements"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("mostra un errore se il caricamento delle misure fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/me/measurements") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
      {
        match: (u, m) => u.endsWith("/me/preferences") && m === "GET",
        body: progressionPreferences,
      },
      {
        match: (u, m) => u.endsWith("/me/account-preferences") && m === "GET",
        body: accountPreferences,
      },
    ]);

    const screen = await renderWithProviders(<ProfileScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });

  it("nella tab Preferenze modifica e salva le preferenze", async () => {
    const fetchMock = mockFetchResponses([
      ...baseHandlers(),
      {
        match: (u: string, m: string) => u.endsWith("/me/preferences") && m === "PUT",
        body: { ...progressionPreferences, requiredConsecutiveSessions: 3 },
      },
      {
        match: (u: string, m: string) => u.endsWith("/me/account-preferences") && m === "PUT",
        body: accountPreferences,
      },
    ]);

    const screen = await renderWithProviders(<ProfileScreen />);
    await screen.findByDisplayValue("80");

    fireEvent.press(screen.getByRole("button", { name: "Preferenze" }));

    const requiredSessionsInput = await screen.findByDisplayValue("2");
    fireEvent.changeText(requiredSessionsInput, "3");
    fireEvent.press(screen.getByRole("button", { name: "Salva preferenze" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/me/preferences"),
        expect.objectContaining({ method: "PUT" })
      );
    });
    expect(await screen.findByText("Preferenze salvate.")).toBeTruthy();
  });
});

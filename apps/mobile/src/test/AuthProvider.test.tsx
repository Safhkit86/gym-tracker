import * as SecureStore from "expo-secure-store";
import { Text, TouchableOpacity, View } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { useAuth } from "../auth/useAuth";

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

/** Consumatrice minimale di useAuth() per esercitare refreshToken senza
 *  dover passare per una schermata reale — non esiste un AuthProvider.
 *  test.tsx dedicato finora (AuthProvider e' sempre stato esercitato
 *  indirettamente dalle schermate). */
function RefreshProbe() {
  const { token, refreshToken } = useAuth();
  return (
    <View>
      <Text>token: {token}</Text>
      <TouchableOpacity onPress={() => void refreshToken()} accessibilityRole="button">
        <Text>Rinnova</Text>
      </TouchableOpacity>
    </View>
  );
}

describe("AuthProvider — refreshToken", () => {
  // Il mock di expo-secure-store (jest.setup.ts) e' una Map in memoria che
  // vive per l'intera durata del file: senza questa pulizia, il token
  // impostato da un test resterebbe visibile al successivo.
  beforeEach(async () => {
    await SecureStore.deleteItemAsync("gym-tracker.token");
  });

  it("sostituisce il token salvato con quello restituito da POST /me/token/refresh", async () => {
    await SecureStore.setItemAsync("gym-tracker.token", "vecchio-token");
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/me/token/refresh") && m === "POST",
        body: { token: "nuovo-token", user: fakeUser },
      },
    ]);

    const screen = await renderWithProviders(<RefreshProbe />);

    await screen.findByText("token: vecchio-token");
    fireEvent.press(screen.getByRole("button", { name: "Rinnova" }));

    await waitFor(() => {
      expect(screen.getByText("token: nuovo-token")).toBeTruthy();
    });
    expect(await SecureStore.getItemAsync("gym-tracker.token")).toBe("nuovo-token");
  });

  it("non chiama l'endpoint se non c'e' nessun token", async () => {
    const fetchMock = mockFetchResponses([]);

    const screen = await renderWithProviders(<RefreshProbe />);

    await screen.findByText("token:");
    fireEvent.press(screen.getByRole("button", { name: "Rinnova" }));

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

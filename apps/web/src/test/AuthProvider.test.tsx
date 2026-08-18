import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses, TEST_TOKEN } from "./helpers";
import { useAuth } from "../auth/useAuth";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

/** Consumatrice minimale di useAuth() per esercitare refreshToken senza
 *  dover passare per una pagina reale — stesso ruolo di un test "diretto"
 *  dell'hook, dato che non esiste un AuthProvider.test.tsx dedicato finora
 *  (AuthProvider e' sempre stato esercitato indirettamente dalle pagine). */
function RefreshProbe() {
  const { token, refreshToken } = useAuth();
  return (
    <div>
      <p>token: {token}</p>
      <button onClick={() => void refreshToken()}>Rinnova</button>
    </div>
  );
}

describe("AuthProvider — refreshToken", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  it("sostituisce il token salvato con quello restituito da POST /me/token/refresh", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/me/token/refresh") && m === "POST",
        body: { token: "nuovo-token", user: FAKE_USER },
      },
    ]);

    renderWithProviders(<RefreshProbe />);

    await screen.findByText(`token: ${TEST_TOKEN}`);
    fireEvent.click(screen.getByRole("button", { name: "Rinnova" }));

    await waitFor(() => {
      expect(screen.getByText("token: nuovo-token")).toBeInTheDocument();
    });
    expect(localStorage.getItem("gym-tracker.token")).toBe("nuovo-token");
  });

  it("non chiama l'endpoint se non c'e' nessun token", async () => {
    localStorage.clear(); // nessun seedAuthToken: parte senza token
    const fetchMock = mockFetchResponses([]);

    renderWithProviders(<RefreshProbe />);

    await screen.findByText("token:");
    fireEvent.click(screen.getByRole("button", { name: "Rinnova" }));

    // Nessuna richiesta di alcun tipo: senza token AuthProvider non fa
    // nemmeno la verifica /me al mount, e refreshToken deve restare no-op.
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

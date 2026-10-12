import { describe, it, expect } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { useAuth } from "../auth/useAuth";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };
const REFRESHED_USER = {
  id: "u1",
  email: "nuova-email@example.com",
  createdAt: FAKE_USER.createdAt,
};

/** Consumatrice minimale di useAuth() per esercitare refreshToken senza
 *  dover passare per una pagina reale. `.catch(() => {})` sul click: stesso
 *  trattamento di useSlidingSession (unico vero chiamante in produzione),
 *  un fallimento di refreshToken non e' un errore bloccante da gestire qui. */
function RefreshProbe() {
  const { token, user, refreshToken } = useAuth();
  return (
    <div>
      <p>token: {token}</p>
      <p>email: {user?.email}</p>
      <button
        onClick={() => {
          void refreshToken().catch(() => {});
        }}
      >
        Rinnova
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("al mount verifica la sessione via GET /me (cookie httpOnly, nessun token da leggere da JS)", async () => {
    mockFetchResponses([{ match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER }]);

    renderWithProviders(<RefreshProbe />);

    // `token` non e' piu' il JWT (illeggibile, httpOnly): e' l'id utente,
    // usato solo come marcatore locale "sessione presente" — vedi
    // AuthProvider.tsx.
    await screen.findByText(`token: ${FAKE_USER.id}`);
    expect(screen.getByText(`email: ${FAKE_USER.email}`)).toBeInTheDocument();
  });

  it("se GET /me risponde 401 (nessuna sessione), token/user restano null", async () => {
    mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/me") && m === "GET",
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Autenticazione mancante (Bearer o cookie)." },
      },
    ]);

    renderWithProviders(<RefreshProbe />);

    await waitFor(() => {
      expect(screen.getByText("token:")).toBeInTheDocument();
    });
    expect(screen.getByText("email:")).toBeInTheDocument();
  });

  it("refreshToken chiama POST /me/token/refresh e aggiorna user/token con la risposta", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/me/token/refresh") && m === "POST",
        body: { token: "nuovo-token", user: REFRESHED_USER },
      },
    ]);

    renderWithProviders(<RefreshProbe />);

    await screen.findByText(`token: ${FAKE_USER.id}`);
    fireEvent.click(screen.getByRole("button", { name: "Rinnova" }));

    await waitFor(() => {
      expect(screen.getByText(`email: ${REFRESHED_USER.email}`)).toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) => String(u).endsWith("/me/token/refresh") && init?.method === "POST"
      )
    ).toBe(true);
  });

  it("refreshToken chiama comunque l'endpoint anche se la verifica iniziale (/me) era fallita", async () => {
    // A differenza del vecchio modello (un controllo locale sul token
    // salvato), refreshToken non ha piu' nulla da controllare client-side
    // prima di chiamare: e' il server (il cookie httpOnly) a decidere se la
    // sessione e' valida. Qui verifichiamo solo che la chiamata parta
    // comunque, non un suo effetto positivo (che non c'e', la sessione non
    // e' valida).
    const fetchMock = mockFetchResponses([
      {
        match: (u, m) => u.endsWith("/me") && m === "GET",
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Autenticazione mancante (Bearer o cookie)." },
      },
      {
        match: (u, m) => u.endsWith("/me/token/refresh") && m === "POST",
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Autenticazione mancante (Bearer o cookie)." },
      },
    ]);

    renderWithProviders(<RefreshProbe />);

    await screen.findByText("token:");
    fireEvent.click(screen.getByRole("button", { name: "Rinnova" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([u, init]) => String(u).endsWith("/me/token/refresh") && init?.method === "POST"
        )
      ).toBe(true);
    });
  });
});

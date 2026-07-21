import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { useAuth } from "../auth/useAuth";
import { apiRequest } from "../api/client";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

/** Componente di test: simula una pagina protetta che fa una chiamata
 * autenticata e finisce per ricevere 401 (token scaduto). */
function ChildThatCallsExpiredToken() {
  const { token } = useAuth();
  useEffect(() => {
    apiRequest("/protected-resource", { token }).catch(() => {
      /* l'evento di logout automatico e' cio' che il test verifica */
    });
  }, [token]);
  return <p>Dashboard</p>;
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reindirizza a /login se non c'e' un token", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<p>Pagina di login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>Dashboard</p>} />
        </Route>
      </Routes>,
      ["/"]
    );

    expect(await screen.findByText("Pagina di login")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("reindirizza a /login quando una richiesta autenticata riceve 401 (token scaduto)", async () => {
    seedAuthToken();
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/protected-resource") && m === "GET",
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Token non valido o scaduto." },
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<p>Pagina di login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<ChildThatCallsExpiredToken />} />
        </Route>
      </Routes>,
      ["/"]
    );

    expect(await screen.findByText("Pagina di login")).toBeInTheDocument();
  });
});

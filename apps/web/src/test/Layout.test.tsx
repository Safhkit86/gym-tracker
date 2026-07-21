import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { Layout } from "../components/Layout";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

describe("Layout", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("mostra il badge con il numero di notifiche non lette", async () => {
    seedAuthToken();
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.includes("/notifications") && m === "GET",
        body: [{ id: "n1" }, { id: "n2" }],
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>Pagina</p>} />
        </Route>
      </Routes>,
      ["/"]
    );

    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("non mostra il badge quando non ci sono notifiche non lette", async () => {
    seedAuthToken();
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.includes("/notifications") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>Pagina</p>} />
        </Route>
      </Routes>,
      ["/"]
    );

    await screen.findByText("Pagina");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("evidenzia la voce di nav corrispondente alla rotta corrente", async () => {
    seedAuthToken();
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.includes("/notifications") && m === "GET", body: [] },
    ]);

    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/workouts" element={<p>Pagina</p>} />
        </Route>
      </Routes>,
      ["/workouts"]
    );

    const schede = await screen.findByRole("link", { name: "Schede" });
    expect(schede.className).toContain("active");
    expect(screen.getByRole("link", { name: /storico/i }).className).not.toContain("active");
  });
});

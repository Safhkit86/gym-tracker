import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "./helpers";
import { ProtectedRoute } from "../auth/ProtectedRoute";

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
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
});

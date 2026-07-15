import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { NotificationsPage } from "../pages/NotificationsPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

const NOTIFICATION_UNREAD = {
  id: "n1",
  exerciseId: "e1",
  exerciseName: "Panca piana",
  suggestionType: "increase_weight",
  previousValue: 80,
  suggestedValue: 82.5,
  reason:
    "Obiettivo di ripetizioni raggiunto per 2 sessioni consecutive a 80kg: aumenta il carico.",
  triggeringSessionId: "s1",
  readAt: null,
  createdAt: new Date().toISOString(),
};

describe("NotificationsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra un messaggio quando non ci sono notifiche", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/notifications") && m === "GET", body: [] },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    expect(await screen.findByText(/nessuna notifica/i)).toBeInTheDocument();
  });

  it("elenca le notifiche e mostra il pulsante segna tutte come lette quando ce ne sono di non lette", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [NOTIFICATION_UNREAD],
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    expect(await screen.findByText("Panca piana")).toBeInTheDocument();
    expect(screen.getByText(/aumenta il carico/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /segna tutte come lette/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^segna come letta$/i })).toBeInTheDocument();
  });

  it("segna una notifica come letta e aggiorna l'elenco", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [{ ...NOTIFICATION_UNREAD, readAt: null }],
      },
      {
        match: (u, m) => u.endsWith("/notifications/n1/read") && m === "PATCH",
        status: 204,
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    fireEvent.click(await screen.findByRole("button", { name: /^segna come letta$/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
    });
  });

  it("segna tutte le notifiche come lette", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [NOTIFICATION_UNREAD],
      },
      {
        match: (u, m) => u.endsWith("/notifications/read-all") && m === "POST",
        body: { count: 1 },
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    fireEvent.click(await screen.findByRole("button", { name: /segna tutte come lette/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
    });
  });
});

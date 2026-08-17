import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses } from "./helpers";
import { NotificationsPage } from "../pages/NotificationsPage";
import { Layout } from "../components/Layout";

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

  it("mostra il delta 'da -> a' per un suggerimento di aumento peso", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [NOTIFICATION_UNREAD],
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    expect(await screen.findByText("80kg → 82.5kg")).toBeInTheDocument();
  });

  it("mostra il delta in ripetizioni per un suggerimento a corpo libero", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [
          {
            ...NOTIFICATION_UNREAD,
            suggestionType: "increase_reps",
            previousValue: 10,
            suggestedValue: 11,
          },
        ],
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    expect(await screen.findByText("10 → 11 rip.")).toBeInTheDocument();
  });

  it("accetta una progressione: salva l'override e segna la notifica come letta", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [NOTIFICATION_UNREAD],
      },
      {
        match: (u, m) => u.endsWith("/me/progression-defaults") && m === "POST",
        status: 204,
      },
      {
        match: (u, m) => u.endsWith("/notifications/n1/accept") && m === "PATCH",
        status: 204,
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    fireEvent.click(await screen.findByRole("button", { name: /^accetta progressione$/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          typeof url === "string" &&
          url.endsWith("/me/progression-defaults") &&
          init?.method === "POST"
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall![1]!.body as string)).toEqual({
        overrides: [{ exerciseId: "e1", suggestionType: "increase_weight", value: 82.5 }],
      });
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
    });
  });

  it("accetta tutte le progressioni: un solo POST con tutti gli override, poi segna tutte come lette", async () => {
    const secondNotification = {
      ...NOTIFICATION_UNREAD,
      id: "n2",
      exerciseId: "e2",
      exerciseName: "Curl bicipiti",
      suggestionType: "increase_reps",
      previousValue: 10,
      suggestedValue: 11,
    };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/notifications") && m === "GET",
        body: [NOTIFICATION_UNREAD, secondNotification],
      },
      {
        match: (u, m) => u.endsWith("/me/progression-defaults") && m === "POST",
        status: 204,
      },
      {
        match: (u, m) => u.endsWith("/notifications/read-all") && m === "POST",
        body: { count: 2 },
      },
    ]);

    renderWithProviders(<NotificationsPage />, ["/notifications"]);

    fireEvent.click(
      await screen.findByRole("button", { name: /^accetta tutte le progressioni$/i })
    );

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          typeof url === "string" &&
          url.endsWith("/me/progression-defaults") &&
          init?.method === "POST"
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall![1]!.body as string)).toEqual({
        overrides: [
          { exerciseId: "e1", suggestionType: "increase_weight", value: 82.5 },
          { exerciseId: "e2", suggestionType: "increase_reps", value: 11 },
        ],
      });
      const readAllCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          typeof url === "string" &&
          url.endsWith("/notifications/read-all") &&
          init?.method === "POST"
      );
      expect(readAllCall).toBeDefined();
    });
  });

  it("aggiorna subito il badge in Layout dopo aver segnato una notifica come letta, senza cambiare pagina", async () => {
    // Mock manuale (non mockFetchResponses) perche' qui serve stato: dopo la
    // PATCH, le richieste successive di /notifications?unread=true devono
    // riflettere che la notifica non e' piu' non letta.
    let isRead = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      const jsonResponse = (body: unknown, status = 200) => ({
        ok: status < 300,
        status,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
      });
      if (url.endsWith("/me") && method === "GET") {
        return jsonResponse(FAKE_USER);
      }
      if (url.endsWith("/notifications/n1/read") && method === "PATCH") {
        isRead = true;
        return jsonResponse(undefined, 204);
      }
      if (url.includes("/notifications?unread=true") && method === "GET") {
        return jsonResponse(isRead ? [] : [{ ...NOTIFICATION_UNREAD, readAt: null }]);
      }
      if (url.endsWith("/notifications") && method === "GET") {
        return jsonResponse([
          { ...NOTIFICATION_UNREAD, readAt: isRead ? new Date().toISOString() : null },
        ]);
      }
      throw new Error(`Nessun handler mockato per ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Routes>,
      ["/notifications"]
    );

    expect(await screen.findByText("1")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /^segna come letta$/i }));

    await waitFor(() => {
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
  });
});

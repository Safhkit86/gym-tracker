import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, seedAuthToken, mockFetchResponses, readBlobAsText } from "./helpers";
import { WorkoutsListPage } from "../pages/WorkoutsListPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

describe("WorkoutsListPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("elenca le schede con il conteggio esercizi", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          {
            id: "w1",
            name: "Push day",
            notes: null,
            exerciseCount: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByRole("link", { name: /push day/i })).toBeInTheDocument();
    expect(screen.getByText(/2 esercizi/)).toBeInTheDocument();
  });

  it("ha un pulsante per registrare una sessione direttamente dalla lista", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          {
            id: "w1",
            name: "Push day",
            notes: null,
            exerciseCount: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    const logLink = await screen.findByRole("link", { name: /registra sessione/i });
    expect(logLink).toHaveAttribute("href", "/workouts/w1/log");
  });

  it("mostra le note della scheda sotto il nome, se presenti", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "GET",
        body: [
          {
            id: "w1",
            name: "1 - Lunedì",
            notes: "Braccia + Petto + Addome",
            exerciseCount: 6,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByText("Braccia + Petto + Addome")).toBeInTheDocument();
  });

  it("mostra un messaggio quando non ci sono schede", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    expect(await screen.findByText("Non hai ancora nessuna scheda.")).toBeInTheDocument();
  });

  const WORKOUT_SUMMARY = {
    id: "w1",
    name: "Push day",
    notes: null,
    exerciseCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("elimina una scheda dalla card dopo la conferma con 'Sì'", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "DELETE", status: 204 },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    await screen.findByRole("link", { name: /push day/i });
    fireEvent.click(screen.getByRole("button", { name: /elimina scheda/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^sì$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    });
    expect(screen.queryByRole("link", { name: /push day/i })).not.toBeInTheDocument();
  });

  it("annulla l'eliminazione dalla card su 'No' senza chiamare l'API", async () => {
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

    await screen.findByRole("link", { name: /push day/i });
    fireEvent.click(screen.getByRole("button", { name: /elimina scheda/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^no$/i }));

    expect(screen.getByRole("link", { name: /push day/i })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("duplica una scheda dalla card: fa il fetch del dettaglio solo alla conferma", async () => {
    const WORKOUT_DETAIL = {
      id: "w1",
      name: "Push day",
      notes: "Focus petto",
      exercises: [
        {
          id: "we1",
          exerciseId: "e1",
          exerciseName: "Panca piana",
          position: 1,
          notes: null,
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              id: "s1",
              setNumber: 1,
              targetMinReps: 10,
              targetMaxReps: null,
              targetWeight: 40,
              restMinSeconds: null,
              restMaxSeconds: null,
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const DUPLICATED = { ...WORKOUT_DETAIL, id: "w2", name: "Push day (copia)" };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/workouts") && m === "POST", status: 201, body: DUPLICATED },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts" element={<WorkoutsListPage />} />
        <Route path="/workouts/:id" element={<p>Dettaglio scheda</p>} />
      </Routes>,
      ["/workouts"]
    );

    await screen.findByRole("link", { name: /push day/i });
    fireEvent.click(screen.getByRole("button", { name: /duplica scheda/i }));

    const input = await screen.findByLabelText(/nome della nuova scheda/i);
    expect(input).toHaveValue("Push day (copia)");
    // Annullando prima di confermare, nessuna chiamata di rete deve essere partita.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /^sì$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
    expect(await screen.findByText("Dettaglio scheda")).toBeInTheDocument();
  });

  const EXERCISE_CATALOG = [
    {
      id: "e1",
      userId: null,
      name: "Panca piana",
      muscleGroup: "Petto",
      description: null,
      sourceUrl: null,
    },
  ];

  it("esporta tutte le schede in un unico file CSV al click su 'Esporta tutto'", async () => {
    const WORKOUT_DETAIL = {
      id: "w1",
      name: "Push day",
      notes: null,
      exercises: [
        {
          id: "we1",
          exerciseId: "e1",
          exerciseName: "Panca piana",
          position: 1,
          notes: null,
          restSeconds: null,
          progressionIncrement: null,
          sets: [
            {
              id: "s1",
              setNumber: 1,
              targetMinReps: 10,
              targetMaxReps: null,
              targetWeight: 40,
              restMinSeconds: null,
              restMaxSeconds: null,
              isMaxEffort: false,
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [WORKOUT_SUMMARY] },
      { match: (u, m) => u.endsWith("/workouts/w1") && m === "GET", body: WORKOUT_DETAIL },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: EXERCISE_CATALOG },
    ]);

    const createObjectURL = vi.fn((_blob: Blob) => "blob:fake-url");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      renderWithProviders(<WorkoutsListPage />, ["/workouts"]);

      await screen.findByRole("link", { name: /push day/i });
      fireEvent.click(screen.getByRole("button", { name: /esporta tutto/i }));

      await waitFor(() => {
        expect(createObjectURL).toHaveBeenCalled();
      });
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const csv = await readBlobAsText(blob);
      const lines = csv
        .replace(/^\uFEFF/, "")
        .trim()
        .split("\r\n");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain("Push day");
    } finally {
      clickSpy.mockRestore();
    }
  });

  const CSV_HEADER =
    "scheda;note_scheda;esercizio;gruppo_muscolare;posizione;note_esercizio;recupero_dopo_esercizio_sec;incremento_progressione;set;rep_min;rep_max;peso_kg;recupero_min_sec;recupero_max_sec;sforzo_massimo";

  function csvFile(content: string, name = "piano.csv"): File {
    return new File([content], name, { type: "text/csv" });
  }

  it("mostra un errore se il file importato non ha le colonne obbligatorie", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);
    await screen.findByText("Non hai ancora nessuna scheda.");

    const input = screen.getByLabelText(/file da importare/i);
    fireEvent.change(input, { target: { files: [csvFile("colonna_a;colonna_b\nfoo;bar")] } });

    expect(await screen.findByText(/mancano le colonne obbligatorie/i)).toBeInTheDocument();
  });

  it("chiede conferma con l'elenco delle schede trovate, poi le importa e aggiorna la lista", async () => {
    const IMPORT_FILE = [CSV_HEADER, "Scheda importata;;Panca piana;Petto;1;;;;1;8;;50;;;"].join(
      "\r\n"
    );
    const CREATED_DETAIL = {
      id: "w-new",
      name: "Scheda importata",
      notes: null,
      exercises: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
      { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: EXERCISE_CATALOG },
      {
        match: (u, m) => u.endsWith("/workouts") && m === "POST",
        status: 201,
        body: CREATED_DETAIL,
      },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);
    await screen.findByText("Non hai ancora nessuna scheda.");

    const input = screen.getByLabelText(/file da importare/i);
    fireEvent.change(input, { target: { files: [csvFile(IMPORT_FILE)] } });

    expect(await screen.findByText(/importare 1 scheda \(scheda importata\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^sì$/i }));

    expect(await screen.findByText(/1 scheda importata/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          (url as string).toString().endsWith("/exercises") && init?.method === "POST"
      )
    ).toBe(false);
    const createWorkoutCall = fetchMock.mock.calls.find(
      ([url, init]) => (url as string).toString().endsWith("/workouts") && init?.method === "POST"
    );
    expect(createWorkoutCall).toBeDefined();
  });

  it("annulla l'import su 'No' senza chiamare l'API", async () => {
    const IMPORT_FILE = [CSV_HEADER, "Scheda importata;;Panca piana;Petto;1;;;;1;8;;50;;;"].join(
      "\r\n"
    );
    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
    ]);

    renderWithProviders(<WorkoutsListPage />, ["/workouts"]);
    await screen.findByText("Non hai ancora nessuna scheda.");

    const input = screen.getByLabelText(/file da importare/i);
    fireEvent.change(input, { target: { files: [csvFile(IMPORT_FILE)] } });

    await screen.findByText(/importare 1 scheda/i);
    fireEvent.click(screen.getByRole("button", { name: /^no$/i }));

    expect(screen.queryByText(/importare 1 scheda/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});

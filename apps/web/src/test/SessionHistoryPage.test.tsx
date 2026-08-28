import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders, seedAuthToken, mockFetchResponses, readBlobAsText } from "./helpers";
import { SessionHistoryPage } from "../pages/SessionHistoryPage";

const FAKE_USER = { id: "u1", email: "test@example.com", createdAt: new Date().toISOString() };

function stubNarrowViewport(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

const SESSION_OLDER = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Push day",
  workoutNotes: "Petto + Tricipiti",
  performedAt: "2026-07-01T10:00:00.000Z",
  notes: "Buona sensazione",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: 2.5,
      restSeconds: 90,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 10,
          targetMaxReps: null,
          actualReps: 10,
          actualWeight: 80,
          actualRpe: 8,
          actualRestSeconds: 90,
        },
        {
          id: "s2",
          setNumber: 2,
          targetMinReps: 10,
          targetMaxReps: null,
          actualReps: 9,
          actualWeight: 80,
          actualRpe: 8,
          actualRestSeconds: 90,
        },
      ],
    },
  ],
  createdAt: "2026-07-01T10:00:00.000Z",
};

const SESSION_NEWER = {
  ...SESSION_OLDER,
  id: "sess2",
  performedAt: "2026-07-08T10:00:00.000Z",
  createdAt: "2026-07-08T10:00:00.000Z",
};

describe("SessionHistoryPage", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra un messaggio quando non ci sono sessioni", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    expect(await screen.findByText(/non hai ancora registrato/i)).toBeInTheDocument();
  });

  it("mostra i dettagli di ogni sessione gia' espansi, dal piu' recente", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [SESSION_NEWER, SESSION_OLDER],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    expect(await screen.findAllByText("Panca piana")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /push day/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("80 kg")).toHaveLength(2);
    expect(screen.getAllByText("90s")).toHaveLength(2);

    const dates = screen.getAllByText(/2026/).map((el) => el.textContent);
    expect(dates[0]).toMatch(/08/);
    expect(dates[1]).toMatch(/01/);

    const notes = screen.getAllByText("Buona sensazione");
    expect(notes[0]).toHaveClass("session-card__notes");

    const workoutNotes = screen.getAllByText("Petto + Tricipiti");
    expect(workoutNotes).toHaveLength(2);
    expect(workoutNotes[0]).toHaveClass("session-card__notes");
  });

  it("il pulsante di ordinamento inverte l'ordine mostrato", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [SESSION_NEWER, SESSION_OLDER],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
    await screen.findAllByText("Panca piana");

    fireEvent.click(screen.getByRole("button", { name: /piu' recenti prima/i }));

    const dates = screen.getAllByText(/2026/).map((el) => el.textContent);
    expect(dates[0]).toMatch(/01/);
    expect(dates[1]).toMatch(/08/);
  });

  it("mostra un separatore di settimana quando ricomincia dalla scheda 1", async () => {
    const week1Monday = {
      ...SESSION_OLDER,
      id: "w1s1",
      workoutName: "1 - Lunedì",
      performedAt: "2026-07-06T10:00:00.000Z",
    };
    const week1Tuesday = {
      ...SESSION_OLDER,
      id: "w1s2",
      workoutName: "2 - Martedì",
      performedAt: "2026-07-07T10:00:00.000Z",
    };
    const week2Monday = {
      ...SESSION_OLDER,
      id: "w2s1",
      workoutName: "1 - Lunedì",
      performedAt: "2026-07-13T10:00:00.000Z",
    };
    const week2Tuesday = {
      ...SESSION_OLDER,
      id: "w2s2",
      workoutName: "2 - Martedì",
      performedAt: "2026-07-14T10:00:00.000Z",
    };

    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        body: [week2Tuesday, week2Monday, week1Tuesday, week1Monday],
      },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
    await screen.findAllByText("Panca piana");

    const dividers = screen.getAllByText(/Settimana \d/).map((el) => el.textContent);
    expect(dividers).toEqual(["Settimana 2", "Settimana 1"]);
  });

  it("su schermi stretti mostra un blocco per esercizio invece della tabella", async () => {
    stubNarrowViewport(true);
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [SESSION_OLDER] },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    await screen.findByText("Panca piana");
    expect(document.querySelector("table")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".stack-block")).toHaveLength(1);
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
    expect(screen.getByText("90s")).toBeInTheDocument();
  });

  it("mostra il recupero EFFETTIVO inserito in Registra Sessione, non quello informativo prescritto dalla scheda", async () => {
    const sessionWithDifferentRest = {
      ...SESSION_OLDER,
      exercises: [
        {
          ...SESSION_OLDER.exercises[0],
          restSeconds: 60, // valore prescritto dalla scheda, solo informativo
          sets: SESSION_OLDER.exercises[0].sets.map((set) => ({
            ...set,
            actualRestSeconds: 120, // quello davvero inserito dall'utente
          })),
        },
      ],
    };
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [sessionWithDifferentRest] },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);

    expect(await screen.findByText("120s")).toBeInTheDocument();
    expect(screen.queryByText("60s")).not.toBeInTheDocument();
  });

  it("elimina una sessione dopo conferma", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [SESSION_OLDER] },
      { match: (u, m) => u.endsWith("/sessions/sess1") && m === "DELETE", status: 204 },
    ]);

    renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
    await screen.findByText("Panca piana");

    fireEvent.click(screen.getByRole("button", { name: /elimina sessione/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sì" }));

    await waitFor(() => {
      expect(screen.getByText(/non hai ancora registrato/i)).toBeInTheDocument();
    });
  });

  const SESSION_CSV_HEADER =
    "id_sessione;scheda;data;note_sessione;esercizio;posizione;recupero_dopo_esercizio_sec;incremento_progressione;set;rep_fatte;peso_kg;rpe;recupero_effettivo_sec";

  function csvFile(content: string, name = "storico.csv"): File {
    return new File([content], name, { type: "text/csv" });
  }

  describe("import/export CSV", () => {
    it("esporta lo storico in un file CSV al click su 'Esporta storico'", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [SESSION_OLDER] },
      ]);

      const createObjectURL = vi.fn((_blob: Blob) => "blob:fake-url");
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = vi.fn();
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      try {
        renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
        await screen.findByText("Panca piana");

        fireEvent.click(screen.getByRole("button", { name: /esporta storico/i }));

        await waitFor(() => {
          expect(createObjectURL).toHaveBeenCalled();
        });
        const blob = createObjectURL.mock.calls[0][0] as Blob;
        const csv = await readBlobAsText(blob);
        const lines = csv
          .replace(/^\uFEFF/, "")
          .trim()
          .split("\r\n");
        expect(lines[0]).toBe(SESSION_CSV_HEADER);
        expect(lines[1]).toContain("Push day");
        expect(lines[1]).toContain("Panca piana");
      } finally {
        clickSpy.mockRestore();
      }
    });

    it("mostra un errore se il file importato non ha le colonne obbligatorie", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato/i);

      const input = screen.getByLabelText(/file storico da importare/i);
      fireEvent.change(input, { target: { files: [csvFile("colonna_a;colonna_b\nfoo;bar")] } });

      expect(await screen.findByText(/mancano le colonne obbligatorie/i)).toBeInTheDocument();
    });

    it("scheda già nel catalogo: conferma semplice, poi registra la sessione", async () => {
      const IMPORT_FILE = [
        SESSION_CSV_HEADER,
        ";Push day;2026-07-20;;Panca piana;1;;;1;10;80;8;",
      ].join("\r\n");
      const fetchMock = mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [SESSION_OLDER] },
        {
          match: (u, m) => u.endsWith("/workouts") && m === "GET",
          body: [
            {
              id: "w1",
              name: "Push day",
              notes: null,
              exerciseCount: 1,
              createdAt: "",
              updatedAt: "",
            },
          ],
        },
        {
          match: (u, m) => u.endsWith("/exercises") && m === "GET",
          body: [
            {
              id: "e1",
              userId: null,
              name: "Panca piana",
              muscleGroup: "Petto",
              description: null,
              sourceUrl: null,
            },
          ],
        },
        {
          match: (u, m) => u.endsWith("/sessions") && m === "POST",
          status: 201,
          body: { ...SESSION_OLDER, id: "new-session" },
        },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText("Panca piana");

      const input = screen.getByLabelText(/file storico da importare/i);
      fireEvent.change(input, { target: { files: [csvFile(IMPORT_FILE)] } });

      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(/importare 1 sessione/i)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Sì" }));

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([url, init]) =>
              (url as string).toString().endsWith("/sessions") && init?.method === "POST"
          )
        ).toBe(true);
      });
      expect(await screen.findByText(/1 sessione importata/i)).toBeInTheDocument();
    });

    it("scheda non nel catalogo: mostra la pagina di approvazione, poi crea la scheda e registra la sessione", async () => {
      const IMPORT_FILE = [
        SESSION_CSV_HEADER,
        ";Gambe pesanti;2026-07-20;;Squat;1;;;1;5;80;;",
      ].join("\r\n");
      const CREATED_WORKOUT = { id: "w-new", name: "Gambe pesanti" };
      const fetchMock = mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        { match: (u, m) => u.endsWith("/workouts") && m === "GET", body: [] },
        { match: (u, m) => u.endsWith("/exercises") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/exercises") && m === "POST",
          status: 201,
          body: {
            id: "e-squat",
            userId: "u1",
            name: "Squat",
            muscleGroup: null,
            description: null,
            sourceUrl: null,
          },
        },
        {
          match: (u, m) => u.endsWith("/workouts") && m === "POST",
          status: 201,
          body: CREATED_WORKOUT,
        },
        {
          match: (u, m) => u.endsWith("/sessions") && m === "POST",
          status: 201,
          body: { ...SESSION_OLDER, id: "new-session", workoutName: "Gambe pesanti" },
        },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato/i);

      const input = screen.getByLabelText(/file storico da importare/i);
      fireEvent.change(input, { target: { files: [csvFile(IMPORT_FILE)] } });

      expect(await screen.findByText("Gambe pesanti")).toBeInTheDocument();
      expect(screen.getByText(/squat \(1 set\)/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Conferma" }));

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([url, init]) =>
              (url as string).toString().endsWith("/workouts") && init?.method === "POST"
          )
        ).toBe(true);
      });
      expect(await screen.findByText(/schede create: gambe pesanti/i)).toBeInTheDocument();
    });
  });

  describe("tab Misure", () => {
    // Delta tutti diversi tra loro apposta: altrimenti piu' campi
    // mostrerebbero lo stesso testo (es. "▲ 0.5") e getByText diventerebbe
    // ambiguo (piu' elementi corrispondenti).
    const ENTRY_NEWER = {
      id: "m2",
      measuredOn: "2026-07-20",
      weightKg: 79.1,
      chestCm: 101.5,
      armCm: 35.8,
      waistCm: 87,
      legCm: 58.2,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z",
    };
    const ENTRY_OLDER = {
      id: "m1",
      measuredOn: "2026-07-13",
      weightKg: 80,
      chestCm: 101,
      armCm: 35.5,
      waistCm: 88,
      legCm: 58,
      createdAt: "2026-07-13T10:00:00.000Z",
      updatedAt: "2026-07-13T10:00:00.000Z",
    };

    it("mostra un messaggio quando non ci sono misurazioni", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [] },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato nessuna sessione/i);

      fireEvent.click(screen.getByRole("button", { name: "Misure" }));

      expect(
        await screen.findByText(/non hai ancora registrato nessuna misurazione/i)
      ).toBeInTheDocument();
    });

    it("elenca le misurazioni con le frecce di variazione mostrate sulla voce piu' nuova", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        {
          match: (u, m) => u.endsWith("/measurements") && m === "GET",
          body: [ENTRY_NEWER, ENTRY_OLDER],
        },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato nessuna sessione/i);
      fireEvent.click(screen.getByRole("button", { name: "Misure" }));

      expect(await screen.findByText("20/07/2026")).toBeInTheDocument();
      expect(screen.getByText("13/07/2026")).toBeInTheDocument();

      // La voce piu' nuova (20/07, peso 79.1) confrontata con la precedente
      // (13/07, peso 80) e' diminuita: freccia giu', mostrata sulla voce
      // nuova (non su quella vecchia).
      expect(screen.getByText("▼ 0.9")).toHaveClass("delta--down");
      // Petto e' aumentato (101 -> 101.5): freccia su.
      expect(screen.getByText("▲ 0.5")).toHaveClass("delta--up");
      // Una freccia per campo sulla voce piu' nuova; la piu' vecchia non ha
      // nulla con cui confrontarsi all'indietro, quindi nessuna freccia sua.
      expect(document.querySelectorAll(".delta")).toHaveLength(5);
    });

    it("elimina una misurazione dopo conferma", async () => {
      mockFetchResponses([
        { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
        { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
        { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [ENTRY_OLDER] },
        { match: (u, m) => u.endsWith("/measurements/m1") && m === "DELETE", status: 204 },
      ]);

      renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
      await screen.findByText(/non hai ancora registrato nessuna sessione/i);
      fireEvent.click(screen.getByRole("button", { name: "Misure" }));
      await screen.findByText("13/07/2026");

      fireEvent.click(screen.getByRole("button", { name: /elimina misurazione/i }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Sì" }));

      await waitFor(() => {
        expect(
          screen.getByText(/non hai ancora registrato nessuna misurazione/i)
        ).toBeInTheDocument();
      });
    });

    const MEASUREMENT_CSV_HEADER = "data;peso_kg;petto_cm;braccio_cm;vita_cm;gamba_cm";

    describe("import/export CSV", () => {
      it("esporta le misure in un file CSV al click su 'Esporta misure'", async () => {
        mockFetchResponses([
          { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
          { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
          { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [ENTRY_OLDER] },
        ]);

        const createObjectURL = vi.fn((_blob: Blob) => "blob:fake-url");
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = vi.fn();
        const clickSpy = vi
          .spyOn(HTMLAnchorElement.prototype, "click")
          .mockImplementation(() => {});

        try {
          renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
          await screen.findByText(/non hai ancora registrato nessuna sessione/i);
          fireEvent.click(screen.getByRole("button", { name: "Misure" }));
          await screen.findByText("13/07/2026");

          fireEvent.click(screen.getByRole("button", { name: /esporta misure/i }));

          await waitFor(() => {
            expect(createObjectURL).toHaveBeenCalled();
          });
          const blob = createObjectURL.mock.calls[0][0] as Blob;
          const csv = await readBlobAsText(blob);
          const lines = csv
            .replace(/^\uFEFF/, "")
            .trim()
            .split("\r\n");
          expect(lines[0]).toBe(MEASUREMENT_CSV_HEADER);
          expect(lines[1]).toBe("2026-07-13;80;101;35.5;88;58");
        } finally {
          clickSpy.mockRestore();
        }
      });

      it("mostra un errore se il file importato non ha la colonna obbligatoria data", async () => {
        mockFetchResponses([
          { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
          { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
          { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [] },
        ]);

        renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
        await screen.findByText(/non hai ancora registrato nessuna sessione/i);
        fireEvent.click(screen.getByRole("button", { name: "Misure" }));
        await screen.findByText(/non hai ancora registrato nessuna misurazione/i);

        const input = screen.getByLabelText(/file misure da importare/i);
        fireEvent.change(input, { target: { files: [csvFile("peso_kg\n75", "misure.csv")] } });

        expect(await screen.findByText(/mancano le colonne obbligatorie/i)).toBeInTheDocument();
      });

      it("importa le misure dopo conferma, riusando l'altezza corrente dell'account", async () => {
        const IMPORT_FILE = [MEASUREMENT_CSV_HEADER, "2026-07-20;79.1;101.5;35.8;87;58.2"].join(
          "\r\n"
        );
        const fetchMock = mockFetchResponses([
          { match: (u, m) => u.endsWith("/me") && m === "GET", body: FAKE_USER },
          { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
          // Handler di "/me/measurements" PRIMA di quello generico
          // "/measurements": endsWith("/measurements") matcherebbe anche
          // "/me/measurements" (find() prende il primo handler che risponde
          // true), quindi l'ordine qui conta.
          {
            match: (u, m) => u.endsWith("/me/measurements") && m === "GET",
            body: {
              heightCm: 181,
              weightKg: 80,
              chestCm: 101,
              armCm: 35.5,
              waistCm: 88,
              legCm: 58,
            },
          },
          {
            match: (u, m) => u.endsWith("/me/measurements") && m === "PUT",
            body: {},
          },
          { match: (u, m) => u.endsWith("/measurements") && m === "GET", body: [ENTRY_OLDER] },
        ]);

        renderWithProviders(<SessionHistoryPage />, ["/sessions"]);
        await screen.findByText(/non hai ancora registrato nessuna sessione/i);
        fireEvent.click(screen.getByRole("button", { name: "Misure" }));
        await screen.findByText("13/07/2026");

        const input = screen.getByLabelText(/file misure da importare/i);
        fireEvent.change(input, { target: { files: [csvFile(IMPORT_FILE, "misure.csv")] } });

        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(/importare 1 misurazione/i)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Sì" }));

        await waitFor(() => {
          const putCall = fetchMock.mock.calls.find(
            ([url, init]) =>
              (url as string).toString().endsWith("/me/measurements") && init?.method === "PUT"
          );
          expect(putCall).toBeDefined();
          const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}");
          expect(body).toEqual({
            heightCm: 181,
            weightKg: 79.1,
            chestCm: 101.5,
            armCm: 35.8,
            waistCm: 87,
            legCm: 58.2,
            measuredOn: "2026-07-20",
          });
        });
        expect(await screen.findByText(/1 misurazione importata/i)).toBeInTheDocument();
      });
    });
  });
});

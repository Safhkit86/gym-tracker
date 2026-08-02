import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithProviders, mockFetchResponses } from "./helpers";
import { HistoryScreen } from "../screens/history/HistoryScreen";

const fakeUser = { id: "u1", email: "a@b.com", createdAt: new Date().toISOString() };

const session = {
  id: "sess1",
  workoutId: "w1",
  workoutName: "Spinta",
  workoutNotes: null,
  performedAt: "2026-08-01T10:00:00.000Z",
  notes: null,
  createdAt: "",
  exercises: [
    {
      exerciseId: "e1",
      exerciseName: "Panca piana",
      workoutExerciseId: "we1",
      progressionIncrement: null,
      restSeconds: 90,
      sets: [
        {
          id: "s1",
          setNumber: 1,
          targetMinReps: 8,
          targetMaxReps: 10,
          actualReps: 9,
          actualWeight: 60,
          actualRpe: null,
          targetRestMinSeconds: 90,
          targetRestMaxSeconds: null,
          actualRestSeconds: 90,
        },
      ],
    },
  ],
};

const measurementNew = {
  id: "m1",
  measuredOn: "2026-08-01",
  weightKg: 79,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
  createdAt: "",
  updatedAt: "",
};

const measurementOld = {
  id: "m2",
  measuredOn: "2026-07-01",
  weightKg: 80,
  chestCm: null,
  armCm: null,
  waistCm: null,
  legCm: null,
  createdAt: "",
  updatedAt: "",
};

beforeEach(async () => {
  await SecureStore.setItemAsync("gym-tracker.token", "fake-token");
});

describe("HistoryScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra le sessioni ed elimina dopo conferma", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });

    const fetchMock = mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [session] },
      { match: (u, m) => u.endsWith("/sessions/sess1") && m === "DELETE", body: undefined },
    ]);

    const screen = await renderWithProviders(<HistoryScreen />);

    expect(await screen.findByText("Spinta")).toBeTruthy();
    expect(screen.getByText("Panca piana")).toBeTruthy();
    expect(screen.getByText("60 kg")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Elimina sessione" }));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/sess1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Spinta")).toBeNull();
    });
  });

  it("mostra un errore se il caricamento sessioni fallisce", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      {
        match: (u, m) => u.endsWith("/sessions") && m === "GET",
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Errore imprevisto. Riprova." },
      },
    ]);

    const screen = await renderWithProviders(<HistoryScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore imprevisto. Riprova.");
  });

  it("carica le misure solo al primo tocco sul tab e mostra il delta", async () => {
    mockFetchResponses([
      { match: (u, m) => u.endsWith("/me") && m === "GET", body: fakeUser },
      { match: (u, m) => u.endsWith("/sessions") && m === "GET", body: [] },
      {
        match: (u, m) => u.endsWith("/measurements") && m === "GET",
        body: [measurementNew, measurementOld],
      },
    ]);

    const screen = await renderWithProviders(<HistoryScreen />);

    await screen.findByText("Non hai ancora registrato nessuna sessione.");
    fireEvent.press(screen.getByRole("button", { name: "Misure" }));

    expect(await screen.findByText("79 kg")).toBeTruthy();
    expect(screen.getByText("▼ 1")).toBeTruthy();
  });
});

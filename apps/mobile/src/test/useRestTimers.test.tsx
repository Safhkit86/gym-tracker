import { act, renderHook } from "@testing-library/react-native";
import { useRestTimers } from "../hooks/useRestTimers";

const mockNotificationAsync = jest.fn(async () => {});
jest.mock("expo-haptics", () => ({
  notificationAsync: () => mockNotificationAsync(),
  NotificationFeedbackType: { Warning: "warning" },
}));

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn(async () => {});
const mockPlayer = { play: mockPlay, pause: mockPause, seekTo: mockSeekTo };
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({
    isLoaded: true,
    duration: 0.36,
    playbackState: "ready",
    reasonForWaitingToPlay: null,
    playing: false,
    currentTime: 0,
  }),
  setAudioModeAsync: jest.fn(async () => {}),
}));

describe("useRestTimers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNotificationAsync.mockClear();
    mockPlay.mockClear();
    mockPause.mockClear();
    mockSeekTo.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("a scadenza vibra sempre; il suono parte solo se soundEnabled e' true", async () => {
    const { result, rerender } = renderHook(
      ({ soundEnabled }: { soundEnabled: boolean }) => useRestTimers(soundEnabled),
      { initialProps: { soundEnabled: false } }
    );

    act(() => {
      result.current.startTimer(1, "Test");
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();

    mockNotificationAsync.mockClear();
    rerender({ soundEnabled: true });

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("snoozeTimer ferma sia la vibrazione sia il suono", async () => {
    const { result } = renderHook(() => useRestTimers(true));

    act(() => {
      result.current.startTimer(1, "Test");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);

    const timer = result.current.timers[0];
    expect(timer).toBeDefined();
    act(() => {
      result.current.snoozeTimer(timer!.id);
    });
    mockNotificationAsync.mockClear();
    mockPlay.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockNotificationAsync).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("snoozeTimer/cancelTimer fermano anche l'impulso sonoro in corso, non solo quelli futuri", async () => {
    // Bug segnalato dall'utente: fermando il timer a meta' di un impulso, il
    // clip in corso continuava a suonare invece di interrompersi subito.
    const { result } = renderHook(() => useRestTimers(true));

    act(() => {
      result.current.startTimer(1, "Test");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();

    act(() => {
      result.current.snoozeTimer(result.current.timers[0]!.id);
    });

    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it("un impulso rimasto orfano (es. schermata ricreata senza smontaggio pulito) non suona piu' una volta partito un nuovo timer", async () => {
    // Bug segnalato dall'utente: se il telefono va in background mentre il
    // timer conta e Android ricrea la schermata al ritorno in foreground,
    // il hook puo' essere ricreato da capo senza che il vecchio passi da un
    // vero smontaggio (nessuna chiamata a cancelTimer/snoozeTimer) — qui
    // simulato non smontando affatto la prima istanza. Con un ref locale
    // per l'intervallo, la nuova istanza partirebbe con un riferimento
    // vuoto e l'impulso "fantasma" della vecchia continuerebbe a suonare
    // per sempre, non fermabile da nessun pulsante della UI nuova.
    const first = renderHook(() => useRestTimers(true));
    act(() => {
      first.result.current.startTimer(1, "Vecchio");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000); // scade e inizia a suonare
    });
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // Nuova istanza del hook, la vecchia MAI smontata: simula la schermata
    // ricreata senza un vero cleanup.
    mockPlay.mockClear();
    const second = renderHook(() => useRestTimers(true));
    act(() => {
      second.result.current.startTimer(1, "Nuovo");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000); // anche il nuovo scade e suona
    });

    mockPlay.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(1500); // una finestra di impulso
    });
    // Un solo impulso, non due sovrapposti (quello vecchio orfano + quello nuovo).
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("al montaggio ferma un impulso orfano anche senza che l'istanza nuova avvii un proprio timer", async () => {
    // Variante del bug sopra dove la nuova istanza non arriva mai ad avere
    // un timer proprio "ringing" (es. l'utente non ne avvia uno nuovo su
    // quella schermata): l'impulso orfano non sarebbe raggiungibile da
    // nessun pulsante (il tray si mostra solo se questa istanza ha
    // timers.length > 0) e continuerebbe a suonare per sempre. Deve fermarsi
    // già al montaggio della nuova istanza, non solo quando ne parte una nuova.
    const first = renderHook(() => useRestTimers(true));
    act(() => {
      first.result.current.startTimer(1, "Vecchio");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockPlay).toHaveBeenCalledTimes(1);

    mockPlay.mockClear();
    renderHook(() => useRestTimers(true)); // mai avviato nessun timer proprio

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("non avvia un secondo timer mentre uno e' gia' attivo", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(60, "Primo");
    });
    expect(result.current.timers).toHaveLength(1);

    act(() => {
      result.current.startTimer(90, "Secondo");
    });
    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0]?.label).toBe("Primo");

    act(() => {
      result.current.cancelTimer(result.current.timers[0]!.id);
    });
    expect(result.current.timers).toHaveLength(0);

    act(() => {
      result.current.startTimer(30, "Terzo");
    });
    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0]?.label).toBe("Terzo");
  });
});

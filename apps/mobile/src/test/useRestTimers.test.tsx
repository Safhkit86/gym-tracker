import { act, renderHook } from "@testing-library/react-native";
import { useRestTimers } from "../hooks/useRestTimers";

const mockNotificationAsync = jest.fn(async () => {});
jest.mock("expo-haptics", () => ({
  notificationAsync: () => mockNotificationAsync(),
  NotificationFeedbackType: { Warning: "warning" },
}));

const mockPlay = jest.fn();
const mockSeekTo = jest.fn(async () => {});
const mockPlayer = { play: mockPlay, seekTo: mockSeekTo };
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

import { act, renderHook } from "@testing-library/react-native";
import { useSlidingSession } from "../hooks/useSlidingSession";

describe("useSlidingSession", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("non richiama refreshToken subito al mount", () => {
    const refreshToken = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useSlidingSession(refreshToken));

    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("richiama refreshToken ogni 20 minuti mentre resta montato", async () => {
    const refreshToken = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useSlidingSession(refreshToken));

    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
    });
    expect(refreshToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
    });
    expect(refreshToken).toHaveBeenCalledTimes(2);
  });

  it("smette di richiamare refreshToken dopo lo smontaggio", async () => {
    const refreshToken = jest.fn().mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useSlidingSession(refreshToken));
    unmount();

    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
    });
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("un tentativo fallito non interrompe i successivi", async () => {
    const refreshToken = jest
      .fn()
      .mockRejectedValueOnce(new Error("rete assente"))
      .mockResolvedValue(undefined);

    renderHook(() => useSlidingSession(refreshToken));

    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
    });
    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
    });

    expect(refreshToken).toHaveBeenCalledTimes(2);
  });

  it("richiama sempre la versione più recente di refreshToken, non quella catturata al primo render", async () => {
    const firstRefresh = jest.fn().mockResolvedValue(undefined);
    const secondRefresh = jest.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ refreshToken }: { refreshToken: () => Promise<void> }) => useSlidingSession(refreshToken),
      { initialProps: { refreshToken: firstRefresh } }
    );
    rerender({ refreshToken: secondRefresh });

    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
    });

    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledTimes(1);
  });
});

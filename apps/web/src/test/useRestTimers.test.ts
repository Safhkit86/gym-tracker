import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRestTimers } from "../hooks/useRestTimers";

describe("useRestTimers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom non implementa Web Audio: stub minimo cosi' alarm-sound.ts non
    // lanci un ReferenceError quando il timer suona (soundEnabled=true nei
    // test che lo esercitano).
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        createOscillator() {
          return {
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            frequency: { value: 0 },
            type: "sine",
          };
        }
        createGain() {
          return {
            connect: vi.fn(),
            gain: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
          };
        }
        resume() {
          return Promise.resolve();
        }
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parte da 'running' col tempo indicato e conta alla rovescia senza drift", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(90, "Panca piana — recupero tra le serie");
    });

    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0]).toMatchObject({
      label: "Panca piana — recupero tra le serie",
      totalSeconds: 90,
      remainingSeconds: 90,
      status: "running",
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.timers[0].remainingSeconds).toBe(80);
    expect(result.current.timers[0].status).toBe("running");
  });

  it("passa a 'ringing' quando arriva a zero", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(3, "Recupero");
    });

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current.timers[0].remainingSeconds).toBe(0);
    expect(result.current.timers[0].status).toBe("ringing");
  });

  it("cancelTimer rimuove il timer mentre e' ancora in corso", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(60, "Recupero");
    });
    expect(result.current.timers).toHaveLength(1);

    act(() => {
      result.current.cancelTimer(result.current.timers[0].id);
    });

    expect(result.current.timers).toHaveLength(0);
  });

  it("snoozeTimer rimuove il timer a scadenza", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(2, "Recupero");
    });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.timers[0].status).toBe("ringing");

    act(() => {
      result.current.snoozeTimer(result.current.timers[0].id);
    });

    expect(result.current.timers).toHaveLength(0);
  });

  it("con soundEnabled=true non lancia errori a scadenza (riproduce l'allarme via Web Audio)", () => {
    const { result } = renderHook(() => useRestTimers(true));

    act(() => {
      result.current.startTimer(1, "Recupero");
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.timers[0].status).toBe("ringing");
  });

  it("piu' timer contemporanei restano indipendenti", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(5, "Primo");
      result.current.startTimer(10, "Secondo");
    });

    expect(result.current.timers).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    const first = result.current.timers.find((t) => t.label === "Primo");
    const second = result.current.timers.find((t) => t.label === "Secondo");
    expect(first?.status).toBe("ringing");
    expect(second?.remainingSeconds).toBe(5);
    expect(second?.status).toBe("running");
  });

  it("non avvia un secondo timer mentre uno e' gia' attivo (chiamate separate, come due click)", () => {
    const { result } = renderHook(() => useRestTimers(false));

    act(() => {
      result.current.startTimer(60, "Primo");
    });
    expect(result.current.timers).toHaveLength(1);

    act(() => {
      result.current.startTimer(90, "Secondo");
    });
    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0].label).toBe("Primo");

    act(() => {
      result.current.cancelTimer(result.current.timers[0].id);
    });
    expect(result.current.timers).toHaveLength(0);

    act(() => {
      result.current.startTimer(30, "Terzo");
    });
    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0].label).toBe("Terzo");
  });
});

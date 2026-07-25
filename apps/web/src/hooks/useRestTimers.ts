import { useCallback, useEffect, useRef, useState } from "react";
import { playAlarmBeep, unlockAlarmAudio } from "../utils/alarm-sound";

export interface RestTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  status: "running" | "ringing";
}

interface UseRestTimersResult {
  timers: RestTimer[];
  startTimer: (seconds: number, label: string) => void;
  /** Disponibile mentre il timer conta ("running"). */
  cancelTimer: (id: string) => void;
  /** Disponibile a scadenza ("ringing"): ferma suono/vibrazione e rimuove il timer. */
  snoozeTimer: (id: string) => void;
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function triggerAlarmPulse(soundEnabled: boolean): void {
  try {
    navigator.vibrate?.(400);
  } catch {
    /* vibrazione non supportata (es. desktop): resta comunque lo shake visivo */
  }
  if (soundEnabled) {
    playAlarmBeep();
  }
}

/**
 * Timer di recupero per Registra sessione (vedi LogSessionPage.tsx): stato
 * locale alla pagina, nessun context globale — se si lascia la pagina il
 * conto alla rovescia si interrompe, come richiesto. Un solo intervallo
 * condiviso ricalcola il tempo residuo di ciascun timer da un timestamp
 * assoluto di scadenza (`endAt`), non da un contatore decrementato ogni
 * tick: cosi' non accumula drift anche se il tab perde il focus.
 */
export function useRestTimers(soundEnabled: boolean): UseRestTimersResult {
  const [timers, setTimers] = useState<RestTimer[]>([]);
  const endAtById = useRef(new Map<string, number>());
  const ringingIntervalById = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const alertedIds = useRef(new Set<string>());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const stopRinging = useCallback((id: string) => {
    const interval = ringingIntervalById.current.get(id);
    if (interval !== undefined) {
      clearInterval(interval);
      ringingIntervalById.current.delete(id);
    }
    alertedIds.current.delete(id);
  }, []);

  const cancelTimer = useCallback(
    (id: string) => {
      endAtById.current.delete(id);
      stopRinging(id);
      setTimers((current) => current.filter((timer) => timer.id !== id));
    },
    [stopRinging]
  );

  const startTimer = useCallback((seconds: number, label: string) => {
    // Chiamata durante un vero gesto utente (il click che avvia il timer):
    // sblocca l'AudioContext ora, cosi' il beep innescato piu' tardi da un
    // setInterval non viene bloccato dalle autoplay policy del browser.
    unlockAlarmAudio();
    const id = createId();
    endAtById.current.set(id, Date.now() + seconds * 1000);
    setTimers((current) => [
      ...current,
      { id, label, totalSeconds: seconds, remainingSeconds: seconds, status: "running" },
    ]);
  }, []);

  useEffect(() => {
    if (timers.length === 0) {
      return;
    }
    const interval = setInterval(() => {
      setTimers((current) =>
        current.map((timer) => {
          if (timer.status === "ringing") {
            return timer;
          }
          const endAt = endAtById.current.get(timer.id);
          if (endAt === undefined) {
            return timer;
          }
          const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
          return remaining === timer.remainingSeconds
            ? timer
            : {
                ...timer,
                remainingSeconds: remaining,
                status: remaining === 0 ? "ringing" : "running",
              };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [timers.length]);

  // Effetti collaterali (vibrazione/suono) per i timer appena diventati
  // "ringing": separati dal calcolo dello stato sopra, per non innescarli
  // dentro l'updater di setState (React StrictMode lo invocherebbe due volte).
  useEffect(() => {
    for (const timer of timers) {
      if (timer.status === "ringing" && !alertedIds.current.has(timer.id)) {
        alertedIds.current.add(timer.id);
        triggerAlarmPulse(soundEnabledRef.current);
        const interval = setInterval(() => triggerAlarmPulse(soundEnabledRef.current), 1500);
        ringingIntervalById.current.set(timer.id, interval);
      }
    }
  }, [timers]);

  // Pulizia totale allo smontaggio della pagina.
  useEffect(() => {
    const intervals = ringingIntervalById.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
    };
  }, []);

  return { timers, startTimer, cancelTimer, snoozeTimer: cancelTimer };
}

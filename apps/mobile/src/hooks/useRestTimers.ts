import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";

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
  /** Disponibile a scadenza ("ringing"): ferma la vibrazione e rimuove il timer. */
  snoozeTimer: (id: string) => void;
}

function triggerAlarmPulse(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/**
 * Timer di recupero per Registra sessione, stesso ruolo di
 * apps/web/src/hooks/useRestTimers.ts ma con vibrazione (expo-haptics)
 * invece di navigator.vibrate/beep audio — nessun suono, solo primo piano
 * (vedi CLAUDE.md/README per la decisione). Stato locale alla schermata:
 * lasciandola il conto alla rovescia si interrompe, come sulla webapp. Un
 * solo intervallo condiviso ricalcola il tempo residuo da un timestamp
 * assoluto di scadenza (`endAt`), non da un contatore decrementato ogni
 * tick, cosi' non accumula drift.
 */
export function useRestTimers(): UseRestTimersResult {
  const [timers, setTimers] = useState<RestTimer[]>([]);
  const endAtById = useRef(new Map<string, number>());
  const ringingIntervalById = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const alertedIds = useRef(new Set<string>());

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
    const id = Crypto.randomUUID();
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

  // Effetti collaterali (vibrazione) per i timer appena diventati "ringing":
  // separati dal calcolo dello stato sopra, per non innescarli dentro
  // l'updater di setState.
  useEffect(() => {
    for (const timer of timers) {
      if (timer.status === "ringing" && !alertedIds.current.has(timer.id)) {
        alertedIds.current.add(timer.id);
        triggerAlarmPulse();
        const interval = setInterval(triggerAlarmPulse, 1500);
        ringingIntervalById.current.set(timer.id, interval);
      }
    }
  }, [timers]);

  // Pulizia totale allo smontaggio della schermata.
  useEffect(() => {
    const intervals = ringingIntervalById.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
    };
  }, []);

  return { timers, startTimer, cancelTimer, snoozeTimer: cancelTimer };
}

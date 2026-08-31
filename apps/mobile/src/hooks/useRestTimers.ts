import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import alarmSoundSource from "../../assets/sounds/rest-timer-alarm.wav";

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

/**
 * Timer di recupero per Registra sessione, stesso ruolo di
 * apps/web/src/hooks/useRestTimers.ts: vibrazione sempre (expo-haptics),
 * suono solo se `soundEnabled` (preferenza `timerSoundEnabled`
 * dell'account) — stesso asset per entrambe le piattaforme, un WAV
 * generato offline (`scripts/generate-alarm-sound.mjs`) che riproduce la
 * stessa identica matematica del chirp sintetizzato via Web Audio API
 * sulla webapp (`apps/web/src/utils/alarm-sound.ts`): React Native non ha
 * un equivalente per sintetizzare toni al volo. Stato locale alla
 * schermata: lasciandola il conto alla rovescia si interrompe, come sulla
 * webapp. Un solo intervallo condiviso ricalcola il tempo residuo da un
 * timestamp assoluto di scadenza (`endAt`), non da un contatore
 * decrementato ogni tick, cosi' non accumula drift.
 */
export function useRestTimers(soundEnabled: boolean): UseRestTimersResult {
  const [timers, setTimers] = useState<RestTimer[]>([]);
  const endAtById = useRef(new Map<string, number>());
  const ringingIntervalById = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const alertedIds = useRef(new Set<string>());
  const player = useAudioPlayer(alarmSoundSource);
  // Sottoscrizione allo stato del player: senza questo hook le proprieta'
  // lette direttamente da `player` (es. `player.isLoaded`) restano
  // un'istantanea presa alla creazione e non si aggiornano mai, causando
  // riproduzioni silenziosamente fallite — verificato empiricamente
  // sull'emulatore. Il valore di ritorno non serve altrove.
  useAudioPlayerStatus(player);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  // Letto (non in dipendenza) dentro startTimer qui sotto, che deve restare
  // una funzione stabile — stesso trucco di soundEnabledRef sopra, per
  // avere sempre il valore più recente senza dover ricreare la callback ad
  // ogni tick del countdown (timers cambia ogni secondo).
  const hasActiveTimerRef = useRef(false);
  hasActiveTimerRef.current = timers.length > 0;

  const triggerAlarmPulse = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (soundEnabledRef.current) {
      // seekTo(0) esplicito prima di play(): la clip dura 0.36s contro un
      // impulso ogni 1.5s, quindi ogni pulsazione trova il player già in
      // stato "ended" — riportarlo all'inizio garantisce che risuoni a ogni
      // impulso invece di restare fermo dopo il primo (verificato che
      // play() da solo, senza riposizionare, non è affidabile in questo
      // scenario).
      player.seekTo(0).then(() => player.play());
    }
  }, [player]);

  const stopRinging = useCallback(
    (id: string) => {
      const interval = ringingIntervalById.current.get(id);
      if (interval !== undefined) {
        clearInterval(interval);
        ringingIntervalById.current.delete(id);
      }
      alertedIds.current.delete(id);
      // Ferma anche l'impulso in corso, non solo quelli futuri: senza questo
      // (bug segnalato dall'utente) un tocco su "Elimina"/"Interrompi
      // sveglia" a metà di un impulso lasciava il clip da 0.36s finire di
      // suonare per conto suo — su alcuni dispositivi Android il player
      // sottostante ha anche impiegato piu' del previsto a fermarsi senza
      // una pause() esplicita, dando l'impressione che suono/vibrazione
      // "restassero" invece di interrompersi subito. pause() e' sincrono e
      // innocuo se il player e' gia' fermo (nessun impulso in corso).
      player.pause();
    },
    [player]
  );

  const cancelTimer = useCallback(
    (id: string) => {
      endAtById.current.delete(id);
      stopRinging(id);
      setTimers((current) => current.filter((timer) => timer.id !== id));
    },
    [stopRinging]
  );

  const startTimer = useCallback((seconds: number, label: string) => {
    // Un solo timer di recupero attivo alla volta, in tutta l'app: mentre
    // uno conta (o suona, in attesa di essere fermato) nessun'altra icona
    // timer deve poterne avviare un altro, stesso o diverso esercizio —
    // richiesto esplicitamente dopo che due timer sovrapposti in
    // RestTimerTray erano confusi da leggere. I pulsanti si disabilitano
    // di conseguenza (vedi hasActiveTimer nel valore di ritorno), questo
    // guard è la difesa di riserva se un pulsante restasse comunque
    // cliccabile.
    if (hasActiveTimerRef.current) {
      return;
    }
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

  // Effetti collaterali (vibrazione/suono) per i timer appena diventati
  // "ringing": separati dal calcolo dello stato sopra, per non innescarli
  // dentro l'updater di setState.
  useEffect(() => {
    for (const timer of timers) {
      if (timer.status === "ringing" && !alertedIds.current.has(timer.id)) {
        alertedIds.current.add(timer.id);
        triggerAlarmPulse();
        const interval = setInterval(triggerAlarmPulse, 1500);
        ringingIntervalById.current.set(timer.id, interval);
      }
    }
  }, [timers, triggerAlarmPulse]);

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

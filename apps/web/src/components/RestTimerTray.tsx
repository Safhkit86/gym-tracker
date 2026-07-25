import type { RestTimer } from "../hooks/useRestTimers";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface RestTimerTrayProps {
  timers: RestTimer[];
  onCancel: (id: string) => void;
  onSnooze: (id: string) => void;
}

/** Widget dei timer di recupero attivi: fisso in basso a destra, impilato
 *  se piu' di uno, sempre visibile anche scorrendo la tabella di Registra
 *  sessione (vedi LogSessionPage.tsx). */
export function RestTimerTray({ timers, onCancel, onSnooze }: RestTimerTrayProps) {
  if (timers.length === 0) {
    return null;
  }

  return (
    <div className="rest-timer-tray">
      {timers.map((timer) => (
        <div
          key={timer.id}
          className={timer.status === "ringing" ? "rest-timer rest-timer--ringing" : "rest-timer"}
        >
          <span className="rest-timer__label">{timer.label}</span>
          <span className="rest-timer__time">
            {timer.status === "ringing"
              ? "Recupero terminato"
              : formatCountdown(timer.remainingSeconds)}
          </span>
          {timer.status === "running" ? (
            <button type="button" className="secondary" onClick={() => onCancel(timer.id)}>
              Elimina
            </button>
          ) : (
            <button type="button" className="secondary" onClick={() => onSnooze(timer.id)}>
              Interrompi sveglia
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

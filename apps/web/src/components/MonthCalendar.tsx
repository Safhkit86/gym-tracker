import { useMemo } from "react";

interface MonthCalendarProps {
  year: number;
  month: number; // 0-11
  /** Giorni (YYYY-MM-DD) con almeno una sessione, nel mese mostrato. */
  trainedDays: Set<string>;
  onSelectDay: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const WEEKDAY_LABELS_IT = ["L", "M", "M", "G", "V", "S", "D"];
const MONTH_LABELS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function toDateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Calendario mensile: navigatore verso una sessione specifica, non un
 *  secondo elenco — l'elenco paginato esistente resta l'unica fonte dei
 *  dati mostrati, questo e' solo una scorciatoia. Scelto all'utente tramite
 *  artifact (Opzione B su 3 mockup), al posto di sostituire l'elenco con
 *  il calendario (Opzione A) o di una heatmap annuale (Opzione C, finita
 *  invece in Dashboard). */
export function MonthCalendar({
  year,
  month,
  trainedDays,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const cells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const firstWeekday = (firstDay.getUTCDay() + 6) % 7; // Lunedi = 0
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const result: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(day);
    }
    return result;
  }, [year, month]);

  return (
    <div className="month-calendar">
      <div className="month-calendar__nav">
        <button
          type="button"
          className="icon-btn"
          onClick={onPrevMonth}
          aria-label="Mese precedente"
        >
          ‹
        </button>
        <span className="month-calendar__label">
          {MONTH_LABELS_IT[month]} {year}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={onNextMonth}
          aria-label="Mese successivo"
        >
          ›
        </button>
      </div>
      <div className="month-calendar__weekdays">
        {WEEKDAY_LABELS_IT.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="month-calendar__grid">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={index} className="month-calendar__cell month-calendar__cell--empty" />;
          }
          const date = toDateOnly(year, month, day);
          const isTrained = trainedDays.has(date);
          return (
            <button
              key={index}
              type="button"
              className={
                "month-calendar__cell" + (isTrained ? " month-calendar__cell--trained" : "")
              }
              disabled={!isTrained}
              onClick={() => onSelectDay(date)}
              aria-label={date}
            >
              <span>{day}</span>
              {isTrained && <span className="month-calendar__dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

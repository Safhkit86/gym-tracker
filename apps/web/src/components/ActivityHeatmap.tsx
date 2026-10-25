import { useMemo } from "react";
import type { DailyActivityEntry } from "@gym-tracker/shared";

interface ActivityHeatmapProps {
  dailyActivity: DailyActivityEntry[];
  /** Numero di mesi mostrati (sempre fino al mese corrente incluso),
   *  non l'anno calendario: scorre con l'utente invece di azzerarsi ogni
   *  gennaio o perdere dicembre a un cambio d'anno. */
  monthsCount?: number;
}

const MONTH_LABELS_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

/** setCount -> livello 0-4 per il colore della cella: soglie scelte sulla
 *  dimensione tipica di una sessione (15-25 set), non su un'analisi
 *  statistica dell'utente — una sessione normale finisce a livello 2-3,
 *  due sessioni lo stesso giorno (es. recupero di un allenamento saltato)
 *  a livello 4. */
function activityLevel(setCount: number): 0 | 1 | 2 | 3 | 4 {
  if (setCount <= 0) return 0;
  if (setCount < 10) return 1;
  if (setCount < 20) return 2;
  if (setCount < 35) return 3;
  return 4;
}

interface MonthBlock {
  year: number;
  month: number; // 0-11
}

function trailingMonths(now: Date, count: number): MonthBlock[] {
  const blocks: MonthBlock[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    blocks.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }
  return blocks;
}

function toDateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Heatmap annuale "Costanza": sostituisce il vecchio calendario a 35
 *  giorni (StreakCalendar) con una finestra di 12 mesi scorrevoli, colorata
 *  per intensita' (numero di set, non kg — vedi commento su
 *  DailyActivityEntry nel tipo condiviso per il perche'). */
export function ActivityHeatmap({ dailyActivity, monthsCount = 12 }: ActivityHeatmapProps) {
  const activityByDay = useMemo(
    () => new Map(dailyActivity.map((d) => [d.date, d.setCount])),
    [dailyActivity]
  );

  const today = useMemo(
    () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
    []
  );
  const months = useMemo(() => trailingMonths(today, monthsCount), [today, monthsCount]);

  return (
    <div className="activity-heatmap">
      {months.map(({ year, month }) => {
        const firstDay = new Date(Date.UTC(year, month, 1));
        const firstWeekday = (firstDay.getUTCDay() + 6) % 7; // Lunedi = 0
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

        const cells: Array<{ day: number } | null> = Array.from(
          { length: firstWeekday },
          () => null
        );
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(Date.UTC(year, month, day));
          if (date > today) break;
          cells.push({ day });
        }

        return (
          <div key={`${year}-${month}`}>
            <div className="activity-heatmap__month-label">{MONTH_LABELS_IT[month]}</div>
            <div className="activity-heatmap__grid">
              {cells.map((cell, index) =>
                cell === null ? (
                  <div
                    key={index}
                    className="activity-heatmap__cell activity-heatmap__cell--empty"
                  />
                ) : (
                  <div
                    key={index}
                    className="activity-heatmap__cell"
                    data-level={activityLevel(
                      activityByDay.get(toDateOnly(year, month, cell.day)) ?? 0
                    )}
                    title={`${toDateOnly(year, month, cell.day)}: ${
                      activityByDay.get(toDateOnly(year, month, cell.day)) ?? 0
                    } set`}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

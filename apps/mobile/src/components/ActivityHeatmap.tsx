import { useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { DailyActivityEntry } from "@gym-tracker/shared";
import { colors, radius, spacing } from "../theme/theme";

interface ActivityHeatmapProps {
  dailyActivity: DailyActivityEntry[];
  /** Numero di mesi mostrati (sempre fino al mese corrente incluso), non
   *  l'anno calendario — vedi lo stesso commento su trailingMonths di
   *  apps/web/src/components/ActivityHeatmap.tsx. */
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

/** setCount -> livello 0-4: stesse soglie di apps/web/src/components/
 *  ActivityHeatmap.tsx (vedi lì il perché). */
function activityLevel(setCount: number): 0 | 1 | 2 | 3 | 4 {
  if (setCount <= 0) return 0;
  if (setCount < 10) return 1;
  if (setCount < 20) return 2;
  if (setCount < 35) return 3;
  return 4;
}

// Opacita' dell'overlay accent sopra la base surface2, non 5 colori hardcoded:
// stessa sfumatura ottenuta da color-mix() sul web (25/50/75/100%), ma senza
// dipendenze — RN non ha un equivalente di color-mix().
const LEVEL_OPACITY: Record<0 | 1 | 2 | 3 | 4, number> = { 0: 0, 1: 0.25, 2: 0.5, 3: 0.75, 4: 1 };

interface MonthBlock {
  year: number;
  month: number;
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

const CELL_SIZE = 9;
const CELL_GAP = 2;
const MONTH_WIDTH = CELL_SIZE * 7 + CELL_GAP * 6;

/** Heatmap annuale "Costanza": equivalente mobile di apps/web/src/components/
 *  ActivityHeatmap.tsx, sostituisce il vecchio StreakCalendar (35 giorni).
 *  12 blocchi mensili fissi in una riga orizzontale scorrevole (non un
 *  grid fluido come sul web: su schermo telefono 12 mesi affiancati
 *  renderebbero celle illeggibili) — scrollata subito al mese corrente al
 *  mount, cosi' l'utente vede "oggi" senza dover scorrere a mano. */
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

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [months]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {months.map(({ year, month }) => {
          const firstDay = new Date(Date.UTC(year, month, 1));
          const firstWeekday = (firstDay.getUTCDay() + 6) % 7;
          const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

          const cells: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(year, month, day));
            if (date > today) break;
            cells.push(day);
          }
          const weekRows: Array<Array<number | null>> = [];
          for (let i = 0; i < cells.length; i += 7) {
            weekRows.push(cells.slice(i, i + 7));
          }

          return (
            <View key={`${year}-${month}`} style={styles.month}>
              <Text style={styles.monthLabel}>{MONTH_LABELS_IT[month]}</Text>
              {weekRows.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekRow}>
                  {week.map((day, dayIndex) => {
                    if (day === null) {
                      return <View key={dayIndex} style={styles.cellEmpty} />;
                    }
                    const setCount = activityByDay.get(toDateOnly(year, month, day)) ?? 0;
                    const level = activityLevel(setCount);
                    return (
                      <View
                        key={dayIndex}
                        style={styles.cell}
                        accessibilityLabel={`${toDateOnly(year, month, day)}: ${setCount} set`}
                      >
                        <View style={[styles.cellFill, { opacity: LEVEL_OPACITY[level] }]} />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  month: {
    width: MONTH_WIDTH,
    gap: 3,
  },
  monthLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  weekRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  cellFill: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.accent,
  },
  cellEmpty: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
});

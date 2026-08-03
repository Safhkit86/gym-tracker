import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

interface StreakCalendarProps {
  /** Date (YYYY-MM-DD) con almeno una sessione, come tornate da GET /stats. */
  trainedDates: string[];
  windowDays?: number;
}

/** Calendario "costanza recente": un riquadro per giorno, ultime N (default
 *  35, 5 settimane) giornate fino a oggi, 7 per riga. Stessa logica di
 *  apps/web/src/components/StreakCalendar.tsx — le date sono confrontate in
 *  UTC per restare coerenti con `streakCalendar` di GET /stats (calcolato
 *  lato server in UTC). */
export function StreakCalendar({ trainedDates, windowDays = 35 }: StreakCalendarProps) {
  const trainedSet = useMemo(() => new Set(trainedDates), [trainedDates]);

  const days = useMemo(() => {
    const todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const result: string[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(todayUtc);
      d.setUTCDate(d.getUTCDate() - i);
      result.push(d.toISOString().slice(0, 10));
    }
    return result;
  }, [windowDays]);

  return (
    <View style={styles.grid}>
      {days.map((day) => (
        <View
          key={day}
          style={[styles.cell, trainedSet.has(day) && styles.cellTrained]}
          accessibilityLabel={day}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  cell: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellTrained: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});

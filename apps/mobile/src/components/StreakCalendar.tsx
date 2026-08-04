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
 *  lato server in UTC).
 *
 *  Le 7 colonne sono chunk espliciti (righe da 7 celle `flex:1,
 *  aspectRatio:1`), non un `flexWrap` libero su celle a larghezza fissa: il
 *  vecchio layout (celle 20x20 + flexWrap) non imponeva davvero 7 per riga,
 *  presumeva solo nel commento che ci stessero — su un container più largo
 *  di ~168px (7 celle da 20px + gap) ne entravano di più, rompendo
 *  l'allineamento settimanale (bug preesistente, visibile già su telefono
 *  con container larghi, non solo su tablet). Le celle a `flex:1,
 *  aspectRatio:1` riproducono lo stesso `grid-template-columns: repeat(7,
 *  1fr)` + `aspect-ratio:1` già usato dalla webapp — corrette a qualunque
 *  larghezza del container. */
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

  const rows = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push(days.slice(i, i + 7));
    }
    return chunks;
  }, [days]);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((day) => (
            <View
              key={day}
              style={[styles.cell, trainedSet.has(day) && styles.cellTrained]}
              accessibilityLabel={day}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
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

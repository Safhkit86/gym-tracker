import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../theme/theme";

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

/** Calendario mensile: navigatore verso una sessione specifica dentro
 *  l'elenco paginato dello Storico, non un secondo elenco — equivalente
 *  mobile di apps/web/src/components/MonthCalendar.tsx (stessa scelta tra
 *  i 3 mockup mostrati all'utente). */
export function MonthCalendar({
  year,
  month,
  trainedDays,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const { t } = useTranslation();

  const cells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const firstWeekday = (firstDay.getUTCDay() + 6) % 7; // Lunedi = 0
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const result: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(day);
    }
    const weeks: Array<Array<number | null>> = [];
    for (let i = 0; i < result.length; i += 7) {
      weeks.push(result.slice(i, i + 7));
    }
    return weeks;
  }, [year, month]);

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={onPrevMonth}
          accessibilityRole="button"
          accessibilityLabel={t("history.calendarPrevMonth")}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.label}>
          {MONTH_LABELS_IT[month]} {year}
        </Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={onNextMonth}
          accessibilityRole="button"
          accessibilityLabel={t("history.calendarNextMonth")}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS_IT.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      {cells.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            if (day === null) {
              return <View key={dayIndex} style={styles.cellEmpty} />;
            }
            const date = toDateOnly(year, month, day);
            const isTrained = trainedDays.has(date);
            return (
              <TouchableOpacity
                key={dayIndex}
                style={[styles.cell, isTrained && styles.cellTrained]}
                disabled={!isTrained}
                onPress={() => onSelectDay(date)}
                accessibilityRole="button"
                accessibilityLabel={date}
              >
                <Text style={styles.cellDay}>{day}</Text>
                {isTrained && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  navButtonText: {
    color: colors.text,
    fontSize: 14,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  weekdayRow: {
    flexDirection: "row",
    gap: 3,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  weekRow: {
    flexDirection: "row",
    gap: 3,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  cellEmpty: {
    flex: 1,
    aspectRatio: 1,
  },
  cellTrained: {
    borderColor: colors.accent,
  },
  cellDay: {
    color: colors.text,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});

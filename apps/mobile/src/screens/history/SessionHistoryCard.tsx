import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { SessionDetail } from "@gym-tracker/shared";
import { colors, radius, spacing } from "../../theme/theme";
import { formatRestSeconds, formatWeight } from "../../utils/session-history-utils";

interface SessionHistoryCardProps {
  session: SessionDetail;
  week: number | undefined;
  isNewWeek: boolean;
  isDeleting: boolean;
  onRequestDelete: () => void;
}

export function SessionHistoryCard({
  session,
  week,
  isNewWeek,
  isDeleting,
  onRequestDelete,
}: SessionHistoryCardProps) {
  const { t, i18n } = useTranslation();
  const bodyweightLabel = t("workouts.detail.bodyweight");

  return (
    <View>
      {isNewWeek && week !== undefined && (
        <View style={styles.weekDivider}>
          <Text style={styles.weekDividerText}>{t("history.week", { number: week })}</Text>
        </View>
      )}
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.workoutName}>{session.workoutName}</Text>
            {session.workoutNotes && <Text style={styles.notes}>{session.workoutNotes}</Text>}
          </View>
          <Text style={styles.date}>
            {new Date(session.performedAt).toLocaleDateString(i18n.language)}
          </Text>
        </View>
        {session.notes && <Text style={styles.notes}>{session.notes}</Text>}

        {session.exercises.map((exercise) => (
          <View key={exercise.exerciseId} style={styles.exerciseBlock}>
            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
            {exercise.sets.map((set) => (
              <View key={set.id} style={styles.row}>
                <Text style={styles.rowLabel}>{t("session.set", { number: set.setNumber })}</Text>
                <Text style={styles.rowValue}>{set.actualReps}</Text>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t("session.weight")}</Text>
              <Text style={styles.rowValue}>{formatWeight(exercise, bodyweightLabel)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t("session.rest")}</Text>
              <Text style={styles.rowValue}>{formatRestSeconds(exercise)}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onRequestDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={t("history.deleteSession")}
        >
          <Text style={styles.deleteButtonText}>{t("history.deleteSession")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekDivider: {
    alignItems: "center",
    marginVertical: spacing.md,
  },
  weekDividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  workoutName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  notes: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  date: {
    color: colors.textMuted,
    fontSize: 13,
  },
  exerciseBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});

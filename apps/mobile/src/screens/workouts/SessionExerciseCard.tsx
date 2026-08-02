import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../../theme/theme";
import {
  formatRestRange,
  formatSetTarget,
  isPositiveNumber,
  type SessionExerciseForm,
  type SessionSetForm,
} from "../../utils/session-form-utils";

interface SessionExerciseCardProps {
  exercise: SessionExerciseForm;
  isLast: boolean;
  nextExerciseName: string | undefined;
  onUpdateExercise: (patch: Partial<SessionExerciseForm>) => void;
  onUpdateSet: (setIndex: number, patch: Partial<SessionSetForm>) => void;
  onStartTimer: (seconds: number, label: string) => void;
}

export function SessionExerciseCard({
  exercise,
  isLast,
  nextExerciseName,
  onUpdateExercise,
  onUpdateSet,
  onStartTimer,
}: SessionExerciseCardProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.name}>{exercise.exerciseName}</Text>

        {exercise.sets.map((set, setIndex) => (
          <View key={setIndex} style={styles.row}>
            <Text style={styles.rowLabel}>
              {t("session.set", { number: set.setNumber })}{" "}
              <Text style={styles.target}>({formatSetTarget(set, t)})</Text>
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={set.actualReps}
              onChangeText={(value) => onUpdateSet(setIndex, { actualReps: value })}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t("session.actualReps", {
                exercise: exercise.exerciseName,
                number: set.setNumber,
              })}
            />
          </View>
        ))}

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t("session.weight")}</Text>
          {exercise.isBodyweight ? (
            <Text style={styles.bodyweightText}>{t("workouts.detail.bodyweight")}</Text>
          ) : (
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={exercise.actualWeight}
              onChangeText={(value) => onUpdateExercise({ actualWeight: value })}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t("session.actualWeight", { exercise: exercise.exerciseName })}
            />
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {t("session.rest")} <Text style={styles.target}>({formatRestRange(exercise)})</Text>
          </Text>
          <View style={styles.restInputRow}>
            <TextInput
              style={[styles.input, styles.restInput]}
              keyboardType="numeric"
              value={exercise.actualRestSeconds}
              onChangeText={(value) => onUpdateExercise({ actualRestSeconds: value })}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t("session.actualRest", { exercise: exercise.exerciseName })}
            />
            <TouchableOpacity
              style={[
                styles.timerButton,
                !isPositiveNumber(exercise.actualRestSeconds) && styles.timerButtonDisabled,
              ]}
              disabled={!isPositiveNumber(exercise.actualRestSeconds)}
              onPress={() =>
                onStartTimer(
                  Number(exercise.actualRestSeconds),
                  t("session.timerLabelBetweenSets", { exercise: exercise.exerciseName })
                )
              }
              accessibilityRole="button"
              accessibilityLabel={t("session.startTimer")}
            >
              <Text style={styles.timerButtonText}>⏱</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {!isLast && exercise.restSeconds !== null && (
        <View style={styles.divider}>
          <Text style={styles.dividerText}>
            {t("workouts.detail.restAfterExercise", { seconds: exercise.restSeconds })}
          </Text>
          <TouchableOpacity
            style={styles.timerButton}
            onPress={() =>
              onStartTimer(
                exercise.restSeconds as number,
                t("session.timerLabelBeforeNext", { exercise: nextExerciseName ?? "" })
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t("session.startTimer")}
          >
            <Text style={styles.timerButtonText}>⏱</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  row: {
    marginBottom: spacing.md,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  target: {
    color: colors.accent,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
  },
  bodyweightText: {
    color: colors.text,
    fontSize: 14,
  },
  restInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  restInput: {
    flex: 1,
  },
  timerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timerButtonDisabled: {
    opacity: 0.4,
  },
  timerButtonText: {
    fontSize: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  dividerText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
});

import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useTranslation } from "react-i18next";
import type { Exercise } from "@gym-tracker/shared";
import { colors, radius, spacing } from "../../theme/theme";
import {
  setMaxRepsHasError,
  setMinRepsHasError,
  setRestMaxSecondsHasError,
  setRestMinSecondsHasError,
  type ExerciseForm,
  type SetForm,
} from "../../utils/workout-form-utils";

interface ExerciseCardProps {
  exercise: ExerciseForm;
  exerciseIndex: number;
  selected: Exercise | undefined;
  groupedCatalog: Array<[string, Exercise[]]>;
  fieldErrors: Set<string>;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateExercise: (patch: Partial<ExerciseForm>) => void;
  onAddSet: () => void;
  onDuplicateSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onUpdateSet: (setIndex: number, patch: Partial<SetForm>) => void;
  onRequestRemove: () => void;
}

export function ExerciseCard({
  exercise,
  exerciseIndex,
  selected,
  groupedCatalog,
  fieldErrors,
  canRemove,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onUpdateExercise,
  onAddSet,
  onDuplicateSet,
  onRemoveSet,
  onUpdateSet,
  onRequestRemove,
}: ExerciseCardProps) {
  const { t } = useTranslation();

  function inputStyle(hasError: boolean) {
    return [styles.input, hasError && styles.inputInvalid];
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.legend}>
          {t("workouts.create.exerciseLegend", { number: exerciseIndex + 1 })}
        </Text>
        <View style={styles.moveButtons}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={!canMoveUp}
            style={[styles.moveButton, !canMoveUp && styles.moveButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("workouts.create.moveUp")}
          >
            <Text style={styles.moveButtonText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={!canMoveDown}
            style={[styles.moveButton, !canMoveDown && styles.moveButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("workouts.create.moveDown")}
          >
            <Text style={styles.moveButtonText}>↓</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>{t("workouts.create.exercise")}</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={exercise.exerciseId}
          onValueChange={(value: string) => onUpdateExercise({ exerciseId: value })}
          style={styles.picker}
          dropdownIconColor={colors.text}
        >
          {groupedCatalog.map(([muscleGroup, items]) =>
            items.map((item) => (
              <Picker.Item key={item.id} label={`${muscleGroup} — ${item.name}`} value={item.id} />
            ))
          )}
        </Picker>
      </View>

      {selected?.description && <Text style={styles.description}>{selected.description}</Text>}

      {exercise.sets.map((set, setIndex) => (
        <View key={setIndex} style={styles.setRow}>
          <View style={styles.maxEffortRow}>
            <Text style={styles.label}>{t("workouts.create.maxEffort")}</Text>
            <Switch
              value={set.isMaxEffort}
              onValueChange={(value) => onUpdateSet(setIndex, { isMaxEffort: value })}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>

          {!set.isMaxEffort && (
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.label}>{t("workouts.create.minReps")}</Text>
                <TextInput
                  style={inputStyle(setMinRepsHasError(fieldErrors, exerciseIndex, setIndex))}
                  keyboardType="numeric"
                  value={set.targetMinReps}
                  onChangeText={(value) => onUpdateSet(setIndex, { targetMinReps: value })}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={`${t("workouts.create.minReps")} ${exerciseIndex}.${setIndex}`}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("workouts.create.maxReps")}</Text>
                <TextInput
                  style={inputStyle(setMaxRepsHasError(fieldErrors, exerciseIndex, setIndex))}
                  keyboardType="numeric"
                  value={set.targetMaxReps}
                  onChangeText={(value) => onUpdateSet(setIndex, { targetMaxReps: value })}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={`${t("workouts.create.maxReps")} ${exerciseIndex}.${setIndex}`}
                />
              </View>
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>{t("workouts.create.weight")}</Text>
              <TextInput
                style={inputStyle(
                  fieldErrors.has(`exercises.${exerciseIndex}.sets.${setIndex}.targetWeight`)
                )}
                keyboardType="numeric"
                value={set.targetWeight}
                onChangeText={(value) => onUpdateSet(setIndex, { targetWeight: value })}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={`${t("workouts.create.weight")} ${exerciseIndex}.${setIndex}`}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>{t("workouts.create.restMin")}</Text>
              <TextInput
                style={inputStyle(setRestMinSecondsHasError(fieldErrors, exerciseIndex, setIndex))}
                keyboardType="numeric"
                value={set.restMinSeconds}
                onChangeText={(value) => onUpdateSet(setIndex, { restMinSeconds: value })}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t("workouts.create.restMax")}</Text>
              <TextInput
                style={inputStyle(setRestMaxSecondsHasError(fieldErrors, exerciseIndex, setIndex))}
                keyboardType="numeric"
                value={set.restMaxSeconds}
                onChangeText={(value) => onUpdateSet(setIndex, { restMaxSeconds: value })}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {exercise.sets.length > 1 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => onRemoveSet(setIndex)}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.create.removeSet")}
            >
              <Text style={styles.secondaryButtonText}>{t("workouts.create.removeSet")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onAddSet}
          accessibilityRole="button"
          accessibilityLabel={t("workouts.create.addSet")}
        >
          <Text style={styles.secondaryButtonText}>{t("workouts.create.addSet")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onDuplicateSet}
          accessibilityRole="button"
          accessibilityLabel={t("workouts.create.duplicateSet")}
        >
          <Text style={styles.secondaryButtonText}>{t("workouts.create.duplicateSet")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("workouts.create.restSeconds")}</Text>
        <TextInput
          style={inputStyle(fieldErrors.has(`exercises.${exerciseIndex}.restSeconds`))}
          keyboardType="numeric"
          value={exercise.restSeconds}
          onChangeText={(value) => onUpdateExercise({ restSeconds: value })}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("workouts.create.progressionIncrement")}</Text>
        <TextInput
          style={inputStyle(fieldErrors.has(`exercises.${exerciseIndex}.progressionIncrement`))}
          keyboardType="numeric"
          value={exercise.progressionIncrement}
          onChangeText={(value) => onUpdateExercise({ progressionIncrement: value })}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {canRemove && (
        <TouchableOpacity
          style={styles.removeExerciseButton}
          onPress={onRequestRemove}
          accessibilityRole="button"
          accessibilityLabel={t("workouts.create.removeExercise")}
        >
          <Text style={styles.removeExerciseButtonText}>{t("workouts.create.removeExercise")}</Text>
        </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  legend: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  moveButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  moveButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  moveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  pickerWrapper: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  picker: {
    color: colors.text,
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  setRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  maxEffortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  field: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
  },
  removeExerciseButton: {
    marginTop: spacing.sm,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  removeExerciseButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
});

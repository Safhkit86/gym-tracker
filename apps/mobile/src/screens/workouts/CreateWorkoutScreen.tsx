import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { Exercise } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { listExercises } from "../../api/exercises";
import { createWorkout } from "../../api/workouts";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";
import { ExerciseCard } from "./ExerciseCard";
import {
  emptyExercise,
  emptySet,
  extractFieldErrorPaths,
  groupByMuscle,
  toWorkoutInput,
  type ExerciseForm,
} from "../../utils/workout-form-utils";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "CreateWorkout">;

export function CreateWorkoutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listExercises(token)
      .then((result) => {
        if (!cancelled) {
          setCatalog(result);
          setExercises([emptyExercise(result[0]?.id ?? "")]);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError ? err.message : t("workouts.create.loadError")
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  function addExercise(): void {
    setExercises((current) => [...current, emptyExercise(catalog?.[0]?.id ?? "")]);
  }

  function moveExercise(index: number, direction: -1 | 1): void {
    setExercises((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) {
        return current;
      }
      next.splice(target, 0, moved);
      return next;
    });
  }

  function requestRemoveExercise(index: number): void {
    Alert.alert(t("workouts.create.removeExerciseConfirmTitle"), undefined, [
      { text: t("workouts.create.cancel"), style: "cancel" },
      {
        text: t("workouts.create.removeExercise"),
        style: "destructive",
        onPress: () => setExercises((current) => current.filter((_, i) => i !== index)),
      },
    ]);
  }

  function updateExercise(index: number, patch: Partial<ExerciseForm>): void {
    setExercises((current) =>
      current.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise))
    );
  }

  function addSet(exerciseIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex ? { ...exercise, sets: [...exercise.sets, emptySet()] } : exercise
      )
    );
  }

  function duplicateSet(exerciseIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) => {
        if (i !== exerciseIndex) {
          return exercise;
        }
        const lastSet = exercise.sets[exercise.sets.length - 1];
        if (!lastSet) {
          return exercise;
        }
        return { ...exercise, sets: [...exercise.sets, { ...lastSet }] };
      })
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? { ...exercise, sets: exercise.sets.filter((_, j) => j !== setIndex) }
          : exercise
      )
    );
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<ExerciseForm["sets"][number]>
  ): void {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
            }
          : exercise
      )
    );
  }

  async function handleSubmit(): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    setFieldErrors(new Set());

    if (exercises.length === 0) {
      setError(t("workouts.create.noExercisesError"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createWorkout(token, toWorkoutInput(name, notes, exercises));
      navigation.replace("WorkoutDetail", { id: result.id });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(extractFieldErrorPaths(err.details));
      } else {
        setError(t("common.errorUnexpected"));
      }
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {loadError}
        </Text>
      </View>
    );
  }

  if (catalog === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (catalog.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t("workouts.create.emptyCatalog")}</Text>
      </View>
    );
  }

  const groupedCatalog = groupByMuscle(catalog);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  return (
    <FlatList
      style={styles.list}
      data={exercises}
      keyExtractor={(item) => item.formId}
      ListHeaderComponent={
        <View style={styles.headerContainer}>
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.create.submit")}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.accentContrast} />
              ) : (
                <Text style={styles.submitButtonText}>{t("workouts.create.submit")}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={addExercise}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.create.addExercise")}
            >
              <Text style={styles.secondaryButtonText}>{t("workouts.create.addExercise")}</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <Text style={styles.label}>{t("workouts.create.name")}</Text>
          <TextInput
            style={[styles.input, fieldErrors.has("name") && styles.inputInvalid]}
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t("workouts.create.name")}
          />

          <Text style={styles.label}>{t("workouts.create.notes")}</Text>
          <TextInput
            style={[styles.input, fieldErrors.has("notes") && styles.inputInvalid]}
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t("workouts.create.notes")}
          />
        </View>
      }
      renderItem={({ item, index }) => (
        <ExerciseCard
          exercise={item}
          exerciseIndex={index}
          selected={catalogById.get(item.exerciseId)}
          groupedCatalog={groupedCatalog}
          fieldErrors={fieldErrors}
          canRemove={exercises.length > 1}
          canMoveUp={index > 0}
          canMoveDown={index < exercises.length - 1}
          onMoveUp={() => moveExercise(index, -1)}
          onMoveDown={() => moveExercise(index, 1)}
          onUpdateExercise={(patch) => updateExercise(index, patch)}
          onAddSet={() => addSet(index)}
          onDuplicateSet={() => duplicateSet(index)}
          onRemoveSet={(setIndex) => removeSet(index, setIndex)}
          onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
          onRequestRemove={() => requestRemoveExercise(index)}
        />
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  headerContainer: {
    padding: spacing.lg,
  },
  toolbar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.accentContrast,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
});

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { WorkoutDetail, WorkoutSet } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { createWorkout, deleteWorkout, getWorkout } from "../../api/workouts";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import { centeredContentStyle } from "../../theme/layout";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";
import { PromptModal } from "../../components/PromptModal";
import { duplicateWorkoutInput } from "../../utils/workout-form-utils";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "WorkoutDetail">;

function formatReps(set: WorkoutSet, t: TFunction): string {
  if (set.isMaxEffort) {
    return t("workouts.detail.maxEffort");
  }
  if (set.targetMaxReps !== null) {
    return `${set.targetMinReps}-${set.targetMaxReps}`;
  }
  return `${set.targetMinReps}`;
}

function formatWeight(set: WorkoutSet, t: TFunction): string {
  return set.targetWeight !== null ? `${set.targetWeight} kg` : t("workouts.detail.bodyweight");
}

function formatRest(set: WorkoutSet): string {
  if (set.restMinSeconds === null) {
    return "—";
  }
  if (set.restMaxSeconds !== null) {
    return `${set.restMinSeconds}-${set.restMaxSeconds}s`;
  }
  return `${set.restMinSeconds}s`;
}

export function WorkoutDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { id } = route.params;
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);

  // Vale per l'intera durata di vita dello screen (mai smontato finche' non
  // si cambia tab in modo permanente, vedi useRefreshOnFocus.ts): usato da
  // load() sotto per non fare setState dopo che una singola invocazione e'
  // stata "superata" da una successiva.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await getWorkout(token, id);
      if (isMountedRef.current) {
        setWorkout(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
      }
    }
  }, [token, id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rifà il fetch anche al ritorno in primo piano, non solo al mount — dopo
  // aver modificato il nome/gli esercizi della scheda (Edit usa popTo, non
  // replace: vedi EditWorkoutScreen.tsx, quindi questa stessa istanza di
  // schermata torna in primo piano senza rimontare) senza questo il
  // dettaglio mostrava ancora il nome/i dati precedenti alla modifica finché
  // non si usciva e rientrava da capo (riportato dall'utente).
  useRefreshOnFocus(navigation, load);

  function requestDelete(): void {
    Alert.alert(t("workouts.detail.deleteConfirmTitle"), undefined, [
      { text: t("workouts.create.cancel"), style: "cancel" },
      {
        text: t("workouts.detail.delete"),
        style: "destructive",
        onPress: () => {
          if (!token) {
            return;
          }
          deleteWorkout(token, id)
            // popTo (non replace): WorkoutsList e' la root dello stack, gia'
            // presente sotto — replace ne creava sempre una seconda istanza
            // in cima (stesso bug di LogSessionScreen/EditWorkoutScreen,
            // qui meno visibile perche' le due liste sono identiche, ma
            // comunque un'istanza di troppo da attraversare andando indietro).
            .then(() => navigation.popTo("WorkoutsList"))
            .catch((err: unknown) => {
              setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
            });
        },
      },
    ]);
  }

  async function handleDuplicateConfirm(newName: string): Promise<void> {
    setShowDuplicatePrompt(false);
    if (!token || !workout) {
      return;
    }
    setIsDuplicating(true);
    try {
      const result = await createWorkout(token, duplicateWorkoutInput(workout, newName));
      navigation.replace("WorkoutDetail", { id: result.id });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
      setIsDuplicating(false);
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{workout.name}</Text>
      {workout.notes && <Text style={styles.notes}>{workout.notes}</Text>}

      <TouchableOpacity
        style={styles.logSessionButton}
        onPress={() => navigation.navigate("LogSession", { id: workout.id })}
        accessibilityRole="button"
        accessibilityLabel={t("session.title")}
      >
        <Text style={styles.logSessionButtonText}>{t("session.title")}</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("EditWorkout", { id: workout.id })}
          accessibilityRole="button"
          accessibilityLabel={t("workouts.detail.edit")}
        >
          <Text style={styles.actionButtonText}>{t("workouts.detail.edit")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowDuplicatePrompt(true)}
          disabled={isDuplicating}
          accessibilityRole="button"
          accessibilityLabel={t("workouts.detail.duplicate")}
        >
          <Text style={styles.actionButtonText}>{t("workouts.detail.duplicate")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={requestDelete}
          accessibilityRole="button"
          accessibilityLabel={t("workouts.detail.delete")}
        >
          <Text style={styles.actionButtonDangerText}>{t("workouts.detail.delete")}</Text>
        </TouchableOpacity>
      </View>

      {workout.exercises.map((exercise) => (
        <View key={exercise.id} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
          {exercise.notes && <Text style={styles.exerciseNotes}>{exercise.notes}</Text>}

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.setCol]}>
                {t("workouts.detail.set")}
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.repsCol]}>
                {t("workouts.detail.reps")}
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.weightCol]}>
                {t("workouts.detail.weight")}
              </Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell, styles.restCol]}>
                {t("workouts.detail.rest")}
              </Text>
            </View>
            {exercise.sets.map((set) => (
              <View key={set.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.setCol]}>{set.setNumber}</Text>
                <Text style={[styles.tableCell, styles.repsCol]}>{formatReps(set, t)}</Text>
                <Text style={[styles.tableCell, styles.weightCol]}>{formatWeight(set, t)}</Text>
                <Text style={[styles.tableCell, styles.restCol]}>{formatRest(set)}</Text>
              </View>
            ))}
          </View>

          {exercise.restSeconds !== null && (
            <Text style={styles.exerciseRest}>
              {t("workouts.detail.restAfterExercise", { seconds: exercise.restSeconds })}
            </Text>
          )}
        </View>
      ))}

      <PromptModal
        visible={showDuplicatePrompt}
        message={t("workouts.detail.duplicatePromptMessage", { name: workout.name })}
        label={t("workouts.detail.duplicatePromptLabel")}
        initialValue={t("workouts.detail.duplicatePromptDefaultName", { name: workout.name })}
        onConfirm={handleDuplicateConfirm}
        onCancel={() => setShowDuplicatePrompt(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    ...centeredContentStyle,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  logSessionButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: -spacing.sm,
  },
  logSessionButtonText: {
    color: colors.accentContrast,
    fontSize: 14,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  actionButtonDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  actionButtonDangerText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  notes: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: -spacing.md,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  exerciseNotes: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableHeaderRow: {
    borderTopWidth: 0,
    backgroundColor: colors.surface2,
  },
  tableCell: {
    color: colors.text,
    fontSize: 13,
    padding: spacing.sm,
  },
  tableHeaderCell: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  setCol: { flex: 0.7 },
  repsCol: { flex: 1 },
  weightCol: { flex: 1.2 },
  restCol: { flex: 1.2 },
  exerciseRest: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type {
  ProgressionEvent,
  SessionDetail,
  SessionProcessingStatus,
  WorkoutDetail,
} from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { getWorkout } from "../../api/workouts";
import { getSessionStatus, listSessions, logSession } from "../../api/sessions";
import { getAccountPreferences, getProgressionDefaults } from "../../api/profile";
import { ApiRequestError } from "../../api/client";
import { useRestTimers } from "../../hooks/useRestTimers";
import { RestTimerTray } from "../../components/RestTimerTray";
import { colors, radius, spacing } from "../../theme/theme";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";
import { SessionExerciseCard } from "./SessionExerciseCard";
import {
  buildInitialExercises,
  toSessionInput,
  type SessionExerciseForm,
  type SessionSetForm,
} from "../../utils/session-form-utils";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "LogSession">;

/** Il motore di regole valuta una sessione in modo asincrono (consuma
 *  `session-logged` in progress-service): questo breve polling dopo il log
 *  simula una risposta sincrona, stesso meccanismo di
 *  apps/web/src/pages/LogSessionPage.tsx. */
const SESSION_STATUS_POLL_INTERVAL_MS = 450;
const SESSION_STATUS_MAX_ATTEMPTS = 10;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function LogSessionScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { id } = route.params;

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<SessionExerciseForm[]>([]);
  const [performedAt, setPerformedAt] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SessionDetail | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<SessionProcessingStatus | "timeout">(
    "pending"
  );
  const [suggestions, setSuggestions] = useState<ProgressionEvent[]>([]);
  const { timers, startTimer, cancelTimer, snoozeTimer } = useRestTimers();

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    Promise.all([
      getWorkout(token, id),
      listSessions(token),
      getAccountPreferences(token),
      getProgressionDefaults(token),
    ])
      .then(([detail, previousSessions, preferences, progressionDefaults]) => {
        if (!cancelled) {
          setWorkout(detail);
          setExercises(
            buildInitialExercises(
              detail,
              previousSessions,
              preferences.prefillScope,
              progressionDefaults
            )
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : t("session.loadError"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, id, t]);

  function updateExercise(exerciseIndex: number, patch: Partial<SessionExerciseForm>): void {
    setExercises((current) =>
      current.map((exercise, i) => (i === exerciseIndex ? { ...exercise, ...patch } : exercise))
    );
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<SessionSetForm>
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
    if (!token || !workout) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await logSession(token, toSessionInput(workout, performedAt, exercises));
      setResult(response);
      setSuggestionStatus("pending");
      void pollForSuggestions(token, response.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function pollForSuggestions(authToken: string, sessionId: string): Promise<void> {
    for (let attempt = 0; attempt < SESSION_STATUS_MAX_ATTEMPTS; attempt++) {
      try {
        const status = await getSessionStatus(authToken, sessionId);
        if (status.status !== "pending") {
          setSuggestionStatus(status.status);
          setSuggestions(status.suggestions);
          return;
        }
      } catch {
        // un tentativo fallito non deve interrompere il polling
      }
      await wait(SESSION_STATUS_POLL_INTERVAL_MS);
    }
    setSuggestionStatus("timeout");
  }

  if (error && !workout) {
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

  if (result) {
    return (
      <View style={styles.container}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{t("session.resultTitle")}</Text>
          <Text style={styles.resultSubtitle}>
            {workout.name} — {new Date(result.performedAt).toLocaleDateString(i18n.language)}
          </Text>
          {suggestionStatus === "pending" && (
            <Text style={styles.resultText}>{t("session.checkingSuggestions")}</Text>
          )}
          {suggestionStatus === "no-suggestion" && (
            <Text style={styles.resultText}>{t("session.noSuggestion")}</Text>
          )}
          {suggestionStatus === "with-suggestion" &&
            suggestions.map((suggestion) => (
              <Text key={suggestion.id} style={styles.suggestion}>
                <Text style={styles.suggestionExercise}>{suggestion.exerciseName}</Text>:{" "}
                {suggestion.reason}
              </Text>
            ))}
          {suggestionStatus === "timeout" && (
            <Text style={styles.resultText}>{t("session.suggestionsTimeout")}</Text>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.replace("WorkoutDetail", { id: workout.id })}
            accessibilityRole="button"
            accessibilityLabel={t("session.backToWorkout")}
          >
            <Text style={styles.backButtonText}>{t("session.backToWorkout")}</Text>
          </TouchableOpacity>
        </View>
        <RestTimerTray timers={timers} onCancel={cancelTimer} onSnooze={snoozeTimer} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.workoutExerciseId}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View style={styles.toolbar}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t("session.submit")}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.accentContrast} />
                ) : (
                  <Text style={styles.submitButtonText}>{t("session.submit")}</Text>
                )}
              </TouchableOpacity>
            </View>

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            {workout.notes && <Text style={styles.workoutNotes}>{workout.notes}</Text>}

            <Text style={styles.label}>{t("session.date")}</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={t("session.date")}
            >
              <Text style={styles.dateButtonText}>
                {new Date(performedAt).toLocaleDateString(i18n.language)}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(performedAt)}
                mode="date"
                maximumDate={new Date()}
                onChange={(_event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setPerformedAt(date.toISOString().slice(0, 10));
                  }
                }}
              />
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <SessionExerciseCard
            exercise={item}
            isLast={index === exercises.length - 1}
            nextExerciseName={exercises[index + 1]?.exerciseName}
            onUpdateExercise={(patch) => updateExercise(index, patch)}
            onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
            onStartTimer={startTimer}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
      <RestTimerTray timers={timers} onCancel={cancelTimer} onSnooze={snoozeTimer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  headerContainer: {
    padding: spacing.lg,
  },
  toolbar: {
    marginBottom: spacing.lg,
  },
  submitButton: {
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
  workoutNotes: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  dateButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  dateButtonText: {
    color: colors.text,
    fontWeight: "600",
  },
  resultCard: {
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  resultText: {
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  suggestion: {
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  suggestionExercise: {
    fontWeight: "700",
  },
  backButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: "center",
  },
  backButtonText: {
    color: colors.text,
    fontWeight: "600",
  },
});

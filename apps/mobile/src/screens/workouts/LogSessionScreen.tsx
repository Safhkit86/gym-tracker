import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useSlidingSession } from "../../hooks/useSlidingSession";
import { RestTimerTray } from "../../components/RestTimerTray";
import { colors, radius, spacing } from "../../theme/theme";
import { centeredContentStyle, MAX_CONTENT_WIDTH_DP } from "../../theme/layout";
import { useIsTabletLandscape } from "../../hooks/useResponsiveLayout";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";
import { SessionExerciseCard } from "./SessionExerciseCard";
import { SessionExerciseTable } from "./SessionExerciseTable";
import {
  buildInitialExercises,
  toSessionInput,
  type SessionExerciseForm,
  type SessionSetForm,
} from "../../utils/session-form-utils";
import {
  clearSessionDraft,
  loadSessionDraft,
  saveSessionDraft,
} from "../../utils/session-draft-storage";

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
  const { token, refreshToken } = useAuth();
  const { id } = route.params;
  const isTabletLandscape = useIsTabletLandscape();

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
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(false);
  // Fresca da server (non dalla bozza locale): serve a "Scarta bozza" per
  // poter tornare ai valori di default senza ricaricare la schermata.
  const [freshExercises, setFreshExercises] = useState<SessionExerciseForm[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const { timers, startTimer, cancelTimer, snoozeTimer } = useRestTimers(timerSoundEnabled);
  const insets = useSafeAreaInsets();
  // Altezza reale della barra fissa "Registra sessione" (vedi footer sotto),
  // misurata via onLayout: serve a RestTimerTray per non sovrapporsi ad
  // essa quando un timer e' attivo (vedi extraBottomOffset).
  const [footerHeight, setFooterHeight] = useState(0);
  function handleFooterLayout(event: LayoutChangeEvent): void {
    setFooterHeight(event.nativeEvent.layout.height);
  }

  // Una sessione di allenamento puo' durare piu' a lungo della scadenza
  // fissa del token (1h): finche' questa schermata resta aperta, il token
  // viene rinnovato periodicamente cosi' non si rischia di dover rifare il
  // login perdendo i dati inseriti. Vedi useSlidingSession.
  useSlidingSession(refreshToken);

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
      .then(async ([detail, previousSessions, preferences, progressionDefaults]) => {
        if (cancelled) {
          return;
        }
        setWorkout(detail);
        const initial = buildInitialExercises(
          detail,
          previousSessions,
          preferences.prefillScope,
          progressionDefaults
        );
        setFreshExercises(initial);

        // Rete di sicurezza indipendente dal token (vedi commento su
        // session-draft-storage.ts): se esiste una bozza recente per questa
        // scheda, riprende da li' invece che dai valori di default.
        const draft = await loadSessionDraft(detail.id);
        if (cancelled) {
          return;
        }
        if (draft) {
          setExercises(draft.exercises);
          setPerformedAt(draft.performedAt);
          setDraftRestored(true);
        } else {
          setExercises(initial);
        }
        setTimerSoundEnabled(preferences.timerSoundEnabled);
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

  // Salva la bozza ad ogni modifica, finche' la scheda e' caricata e non si
  // e' ancora inviata la sessione. Scrive solo se lo stato differisce
  // davvero dai valori di default: senza questo confronto, "Scarta bozza"
  // (che riporta exercises a freshExercises) verrebbe subito ri-salvato da
  // questo stesso effetto al render successivo, vanificando lo scarto.
  useEffect(() => {
    if (!workout || result) {
      return;
    }
    const isUnchanged =
      performedAt === today() && JSON.stringify(exercises) === JSON.stringify(freshExercises);
    if (isUnchanged) {
      return;
    }
    void saveSessionDraft(workout.id, { performedAt, exercises });
  }, [workout, result, performedAt, exercises, freshExercises]);

  function discardDraft(): void {
    if (!workout) {
      return;
    }
    void clearSessionDraft(workout.id);
    setExercises(freshExercises);
    setPerformedAt(today());
    setDraftRestored(false);
  }

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
      void clearSessionDraft(workout.id);
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
            // popTo (non replace): se si arriva qui da WorkoutDetail
            // ("Avvia sessione"), quello stesso WorkoutDetail e' già nello
            // stack sotto LogSession — replace lo sostituiva SEMPRE con
            // un'istanza nuova, lasciandone due impilate (l'originale +
            // quella appena creata) e rompendo il tasto indietro (due
            // "indietro" per uscire dalla scheda invece di uno, riportato
            // dall'utente). Se invece si arriva dalla Dashboard ("Avvia
            // sessione" da Prossima sessione, stack senza WorkoutDetail),
            // popTo si comporta come navigate: nessuna istanza da
            // riportare in cima, ne aggiunge una sola.
            onPress={() => navigation.popTo("WorkoutDetail", { id: workout.id })}
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

  const header = (
    <View style={styles.headerContainer}>
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {workout.notes && <Text style={styles.workoutNotes}>{workout.notes}</Text>}

      {draftRestored && (
        <View style={styles.draftNotice} accessibilityRole="alert">
          <Text style={styles.draftNoticeText}>{t("session.draftRestored")}</Text>
          <TouchableOpacity onPress={discardDraft} accessibilityRole="button">
            <Text style={styles.draftNoticeAction}>{t("session.discardDraft")}</Text>
          </TouchableOpacity>
        </View>
      )}

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
          // onChange e' deprecata dalla libreria (onValueChange/onDismiss/
          // onNeutralButtonPress la sostituiscono, vedi CHANGELOG del
          // pacchetto) — onValueChange passa sempre una data valida (mai
          // undefined, a differenza del vecchio onChange), onDismiss copre
          // separatamente il caso "chiuso senza scegliere".
          onValueChange={(_event, date) => {
            setShowDatePicker(false);
            setPerformedAt(date.toISOString().slice(0, 10));
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}
    </View>
  );

  // Barra fissa in fondo (non piu' in cima alla lista, dove diventava
  // irraggiungibile scrollando una sessione con molti esercizi — riportato
  // dall'utente), stesso principio del footer di WorkoutForm.tsx.
  const footer = (
    <View
      style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}
      onLayout={handleFooterLayout}
    >
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
  );

  // In verticale (telefono, o tablet in portrait) resta identico allo
  // smartphone: stack di SessionExerciseCard in una FlatList. Solo su
  // tablet in landscape si passa alla tabella in stile webapp — vedi
  // SessionExerciseTable, che legge/scrive lo stesso stato sollevato qui
  // (updateExercise/updateSet), nessuna duplicazione: ruotare a metà
  // compilazione non perde dati.
  return (
    <View style={styles.container}>
      {isTabletLandscape ? (
        <ScrollView style={styles.landscapeScroll} contentContainerStyle={styles.landscapeContent}>
          {header}
          <SessionExerciseTable
            exercises={exercises}
            onUpdateExercise={updateExercise}
            onUpdateSet={updateSet}
            onStartTimer={startTimer}
            hasActiveTimer={timers.length > 0}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.workoutExerciseId}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <SessionExerciseCard
              exercise={item}
              isLast={index === exercises.length - 1}
              nextExerciseName={exercises[index + 1]?.exerciseName}
              onUpdateExercise={(patch) => updateExercise(index, patch)}
              onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
              onStartTimer={startTimer}
              hasActiveTimer={timers.length > 0}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      {footer}
      <RestTimerTray
        timers={timers}
        onCancel={cancelTimer}
        onSnooze={snoozeTimer}
        extraBottomOffset={footerHeight}
      />
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
    ...centeredContentStyle,
  },
  // flex:1 esplicito: la ScrollView non lo eredita automaticamente da sola
  // in una colonna flex con piu' fratelli (ora anche il footer sotto),
  // stesso motivo di "list" in WorkoutForm.tsx.
  landscapeScroll: {
    flex: 1,
  },
  // Niente cap+centra qui a differenza di listContent: la tabella deve
  // poter usare tutta la larghezza del tablet in landscape, non i ~640dp
  // di un form a colonna singola.
  landscapeContent: {
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
  // Stesso trattamento (12%/35% di opacita' sull'accent) della classe
  // .draft-notice della webapp — qui via rgba, dato che React Native non
  // supporta color-mix().
  draftNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
    backgroundColor: "rgba(34, 195, 176, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 195, 176, 0.35)",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  draftNoticeText: {
    color: colors.text,
    fontSize: 13,
    flexShrink: 1,
  },
  draftNoticeAction: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  // Barra fissa in fondo (vedi commento nel render sopra) — stesso
  // cap+centra usato per il resto del form a colonna singola, cosi' su
  // schermi larghi il pulsante non si allarga a piena larghezza.
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH_DP,
    alignSelf: "center",
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

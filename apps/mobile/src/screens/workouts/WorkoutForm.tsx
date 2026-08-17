import { useRef, useState } from "react";
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
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Exercise, WorkoutInput } from "@gym-tracker/shared";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import { centeredContentStyle, MAX_CONTENT_WIDTH_DP } from "../../theme/layout";
import { ExerciseCard } from "./ExerciseCard";
import {
  emptyExercise,
  emptySet,
  extractFieldErrorPaths,
  groupByMuscle,
  toWorkoutInput,
  type ExerciseForm,
} from "../../utils/workout-form-utils";

interface WorkoutFormProps {
  catalog: Exercise[];
  initialName?: string;
  initialNotes?: string;
  initialExercises?: ExerciseForm[];
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: WorkoutInput) => Promise<void>;
}

/** Form condiviso da creazione e modifica scheda, stesso ruolo di
 *  apps/web/src/components/WorkoutForm.tsx. */
export function WorkoutForm({
  catalog,
  initialName,
  initialNotes,
  initialExercises,
  submitLabel,
  submittingLabel,
  onSubmit,
}: WorkoutFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [exercises, setExercises] = useState<ExerciseForm[]>(
    initialExercises ?? [emptyExercise(catalog[0]?.id ?? "")]
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const listRef = useRef<FlatList<ExerciseForm>>(null);
  const insets = useSafeAreaInsets();

  function addExercise(): void {
    setExercises((current) => [...current, emptyExercise(catalog[0]?.id ?? "")]);
    // Il pulsante "Aggiungi esercizio" sta nella barra fissa in fondo (non
    // piu' nell'header, vedi footer sotto): senza scroll automatico, la
    // nuova card appare comunque fuori dallo schermo, e l'utente deve
    // accorgersi di scorrere per trovarla — non ovvio, verificato con
    // l'utente. setTimeout (non requestAnimationFrame: la FlatList deve
    // aver misurato la nuova riga prima di poterci scorrere, un frame non
    // e' sempre sufficiente su dispositivi lenti) lascia il tempo al
    // layout di aggiornarsi dopo il nuovo state.
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }

  // Stesso scroll automatico di addExercise, ma per un set aggiunto/duplicato
  // DENTRO una card che puo' stare ovunque nella lista, non solo in fondo
  // (riportato dall'utente: si doveva scorrere a mano per vedere il set
  // appena aggiunto). scrollToIndex invece di scrollToEnd, allineato al
  // fondo del viewport (viewPosition: 1) cosi' il nuovo set, aggiunto in
  // fondo alla card, ricade nell'area visibile. onScrollToIndexFailed sotto
  // e' la rete di sicurezza standard di RN per liste ad altezza variabile
  // (nessun getItemLayout qui: il numero di set per card cambia).
  function scrollToExercise(exerciseIndex: number): void {
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: exerciseIndex, viewPosition: 1, animated: true });
    }, 50);
  }

  function handleScrollToIndexFailed(info: { index: number; averageItemLength: number }): void {
    setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: true,
      });
      scrollToExercise(info.index);
    }, 100);
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
    scrollToExercise(exerciseIndex);
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
    scrollToExercise(exerciseIndex);
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
    setError(null);
    setFieldErrors(new Set());

    if (exercises.length === 0) {
      setError(t("workouts.create.noExercisesError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(toWorkoutInput(name, notes, exercises));
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

  const groupedCatalog = groupByMuscle(catalog);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={exercises}
        keyExtractor={(item) => item.formId}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
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
      {/* Barra fissa in fondo, non piu' in cima alla lista: "Crea scheda"/
          "Salva modifiche" e "Aggiungi esercizio" erano irraggiungibili
          senza riscorrere fino in cima dopo aver compilato una scheda con
          molti esercizi — riportato dall'utente. Stesso principio di
          RestTimerTray (sempre visibile), ma qui come footer che riserva
          il proprio spazio invece di sovrapporsi al contenuto, per non
          coprire l'ultima card mentre si scrolla. */}
      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.accentContrast} />
          ) : (
            <Text style={styles.submitButtonText}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    ...centeredContentStyle,
  },
  headerContainer: {
    padding: spacing.lg,
  },
  // Barra fissa in fondo (vedi commento nel render): stesso cap+centra del
  // resto del form, cosi' su schermi larghi i pulsanti restano allineati
  // sotto i campi invece di allargarsi a piena larghezza.
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH_DP,
    alignSelf: "center",
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

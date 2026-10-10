import { createContext, useContext, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type FlatListProps,
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

// Indice (nella FlatList di esercizi) della card la cui ExerciseCombobox e'
// attualmente aperta, o null se nessuna. Un Context (letto da un componente
// stabile fuori da WorkoutForm, vedi ExerciseCell sotto) invece di una prop
// chiusa nella closure di CellRendererComponent: se CellRendererComponent
// fosse definita dentro WorkoutForm, la sua identita' cambierebbe a ogni
// render di WorkoutForm (es. ogni tasto digitato in un campo qualsiasi),
// facendo smontare/rimontare ogni card della FlatList — perdita del focus
// sui TextInput, reset di eventuale stato locale. Con il Context,
// ExerciseCell resta lo stesso componente tra i render e si aggiorna solo
// quando openExerciseIndex cambia davvero.
const OpenExerciseIndexContext = createContext<number | null>(null);

type ExerciseCellProps = ComponentProps<
  NonNullable<FlatListProps<ExerciseForm>["CellRendererComponent"]>
>;

/** Alza zIndex/elevation della card la cui combobox e' aperta sopra le
 *  card successive della stessa FlatList: in React Native lo zIndex
 *  ordina solo i figli diretti di uno stesso genitore, quindi lo
 *  zIndex/elevation impostati dentro ExerciseCombobox (interni alla card)
 *  non bastano a farla vincere sulla card SUCCESSIVA nella lista (sorella
 *  a livello di FlatList, non di ExerciseCombobox) — la tendina che esce
 *  dai bordi della card viene coperta/intercetta i tocchi dalla card dopo
 *  di essa. Sul web non capita perche' lo z-index CSS vince a prescindere
 *  dall'ordine nel DOM (verificato). Causa di "non si riesce piu' a
 *  modificare il nome di un esercizio... scegliendo dalla combo box"
 *  quando la card non e' l'ultima della lista.
 */
function ExerciseCell({ index, style, children, ...rest }: ExerciseCellProps) {
  const openIndex = useContext(OpenExerciseIndexContext);
  const elevated = index === openIndex;
  return (
    // testID usato dal test di regressione (WorkoutForm.test.tsx) per
    // verificare lo zIndex/elevation della card, non raggiungibile in altro
    // modo da un test black-box (nessun effetto visivo osservabile senza un
    // vero motore di rendering/hit-testing).
    <View
      testID={`exercise-cell-${index}`}
      style={[style, elevated && styles.elevatedExerciseCell]}
      {...rest}
    >
      {children}
    </View>
  );
}

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
  const [openExerciseIndex, setOpenExerciseIndex] = useState<number | null>(null);
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

  function handleComboboxOpenChange(index: number, isOpen: boolean): void {
    setOpenExerciseIndex((current) => {
      if (isOpen) {
        return index;
      }
      // Chiude solo se è ancora questa la card segnata come aperta: evita
      // che un vecchio scheduleClose ritardato (vedi ExerciseCombobox)
      // azzeri per errore l'indice di una card apertasi nel frattempo.
      return current === index ? null : current;
    });
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
      <OpenExerciseIndexContext.Provider value={openExerciseIndex}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={exercises}
          keyExtractor={(item) => item.formId}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          CellRendererComponent={ExerciseCell}
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
              onComboboxOpenChange={(isOpen) => handleComboboxOpenChange(index, isOpen)}
              onAddSet={() => addSet(index)}
              onDuplicateSet={() => duplicateSet(index)}
              onRemoveSet={(setIndex) => removeSet(index, setIndex)}
              onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
              onRequestRemove={() => requestRemoveExercise(index)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      </OpenExerciseIndexContext.Provider>
      {/* Barra fissa in fondo, non piu' in cima alla lista: "Crea scheda"/
          "Salva modifiche" e "Aggiungi esercizio" erano irraggiungibili
          senza riscorrere fino in cima dopo aver compilato una scheda con
          molti esercizi — riportato dall'utente. Stesso principio di
          RestTimerTray (sempre visibile), ma qui come footer che riserva
          il proprio spazio invece di sovrapporsi al contenuto, per non
          coprire l'ultima card mentre si scrolla. zIndex/elevation più
          bassi di styles.list (vedi sotto): se l'ultimo esercizio ha la
          combobox aperta, la tendina che esce dal fondo della FlatList
          deve restare sopra questa barra, non sotto. */}
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
    // Sopra il footer (vedi styles.footer): vedi commento nel render.
    zIndex: 1,
    elevation: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    ...centeredContentStyle,
  },
  headerContainer: {
    padding: spacing.lg,
  },
  // Card nella FlatList la cui ExerciseCombobox e' aperta (vedi
  // ExerciseCell/OpenExerciseIndexContext sopra): la tendina esce dal
  // fondo della card e deve restare sopra la card successiva.
  elevatedExerciseCell: {
    zIndex: 10,
    elevation: 10,
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

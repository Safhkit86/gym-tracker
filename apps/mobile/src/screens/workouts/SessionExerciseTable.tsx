import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../../theme/theme";
import {
  formatRestRange,
  formatSetTarget,
  isPositiveNumber,
  type SessionExerciseForm,
  type SessionSetForm,
} from "../../utils/session-form-utils";

interface SessionExerciseTableProps {
  exercises: SessionExerciseForm[];
  onUpdateExercise: (exerciseIndex: number, patch: Partial<SessionExerciseForm>) => void;
  onUpdateSet: (exerciseIndex: number, setIndex: number, patch: Partial<SessionSetForm>) => void;
  onStartTimer: (seconds: number, label: string) => void;
  /** Un timer di recupero è già attivo (in conto o in suoneria): tutte le
   *  icone timer della tabella si disabilitano, non se ne può avviare un
   *  secondo mentre uno è già in corso. */
  hasActiveTimer: boolean;
}

const EXERCISE_COL_WIDTH = 150;
const SET_COL_WIDTH = 84;
// Più larga delle colonne Set: deve ospitare "bodyweight" (il testo più
// lungo che può comparire qui, per gli esercizi a corpo libero) su una
// riga sola — a 84dp (larghezza delle colonne Set) andava a capo su due
// righe, trovato verificando sull'AVD.
const KG_COL_WIDTH = 104;
const REST_COL_WIDTH = 140;

/** Vista "Registra sessione" per tablet in landscape: una tabella che
 *  ricalca apps/web/src/pages/LogSessionPage.tsx (righe 575-700) — colonne
 *  Esercizio, Set 1…N, Kg, Recupero, una riga per esercizio — invece dello
 *  stack di SessionExerciseCard usato in verticale/su telefono. Legge e
 *  scrive lo STESSO stato sollevato in LogSessionScreen (le stesse
 *  onUpdateExercise/onUpdateSet passate a SessionExerciseCard): nessuno
 *  stato duplicato, così ruotare a metà compilazione non perde nulla.
 *
 *  React Native non ha <table>: colonne a larghezza fissa (non flex, a
 *  differenza delle griglie di card altrove in questo piano) dentro uno
 *  ScrollView orizzontale — se una sessione ha abbastanza set da non
 *  entrare nemmeno nei 1280dp del landscape tablet, scorre lateralmente
 *  invece di schiacciarsi; altrimenti lo ScrollView non mostra alcuna
 *  scrollbar visibile (il contenuto entra già). */
export function SessionExerciseTable({
  exercises,
  onUpdateExercise,
  onUpdateSet,
  onStartTimer,
  hasActiveTimer,
}: SessionExerciseTableProps) {
  const { t } = useTranslation();
  const maxSets = exercises.reduce((max, exercise) => Math.max(max, exercise.sets.length), 0);
  const setIndexes = Array.from({ length: maxSets }, (_, i) => i);
  const tableWidth = EXERCISE_COL_WIDTH + SET_COL_WIDTH * maxSets + KG_COL_WIDTH + REST_COL_WIDTH;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={maxSets > 4}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={{ width: tableWidth }}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, { width: EXERCISE_COL_WIDTH }]}>
            {t("session.table.exercise")}
          </Text>
          {setIndexes.map((setIndex) => (
            <Text key={setIndex} style={[styles.headerCell, { width: SET_COL_WIDTH }]}>
              {t("session.set", { number: setIndex + 1 })}
            </Text>
          ))}
          <Text style={[styles.headerCell, { width: KG_COL_WIDTH }]}>{t("session.weight")}</Text>
          <Text style={[styles.headerCell, { width: REST_COL_WIDTH }]}>{t("session.rest")}</Text>
        </View>

        {exercises.map((exercise, exerciseIndex) => (
          <Fragment key={exercise.workoutExerciseId}>
            <View style={styles.row}>
              <Text style={[styles.exerciseNameCell, { width: EXERCISE_COL_WIDTH }]}>
                {exercise.exerciseName}
              </Text>

              {setIndexes.map((setIndex) => {
                const set = exercise.sets[setIndex];
                if (!set) {
                  return <View key={setIndex} style={{ width: SET_COL_WIDTH }} />;
                }
                return (
                  <View key={setIndex} style={[styles.cell, { width: SET_COL_WIDTH }]}>
                    <Text style={styles.cellTarget}>{formatSetTarget(set, t)}</Text>
                    <TextInput
                      style={styles.cellInput}
                      keyboardType="numeric"
                      value={set.actualReps}
                      onChangeText={(value) =>
                        onUpdateSet(exerciseIndex, setIndex, { actualReps: value })
                      }
                      placeholderTextColor={colors.textMuted}
                      accessibilityLabel={t("session.actualReps", {
                        exercise: exercise.exerciseName,
                        number: set.setNumber,
                      })}
                    />
                  </View>
                );
              })}

              <View style={[styles.cell, { width: KG_COL_WIDTH }]}>
                {/* Spaziatore invisibile: allinea verticalmente l'input Kg
                    con gli input Set N/Recupero, che hanno un'etichetta
                    target sopra — stessa tecnica di
                    apps/web/src/pages/LogSessionPage.tsx (righe 622-627,
                    "Riga vuota: nessun obiettivo di peso mostrato qui, ma
                    la stessa altezza della riga target ... tiene la
                    casella allineata verticalmente"). */}
                <Text style={styles.cellTarget}> </Text>
                {exercise.isBodyweight ? (
                  <View style={styles.bodyweightBox}>
                    <Text style={styles.bodyweightText}>{t("workouts.detail.bodyweight")}</Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.cellInput}
                    keyboardType="numeric"
                    value={exercise.actualWeight}
                    onChangeText={(value) =>
                      onUpdateExercise(exerciseIndex, { actualWeight: value })
                    }
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={t("session.actualWeight", {
                      exercise: exercise.exerciseName,
                    })}
                  />
                )}
              </View>

              <View style={[styles.cell, { width: REST_COL_WIDTH }]}>
                <Text style={styles.cellTarget}>{formatRestRange(exercise)}</Text>
                <View style={styles.restInputRow}>
                  <TextInput
                    style={[styles.cellInput, styles.restInput]}
                    keyboardType="numeric"
                    value={exercise.actualRestSeconds}
                    onChangeText={(value) =>
                      onUpdateExercise(exerciseIndex, { actualRestSeconds: value })
                    }
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={t("session.actualRest", {
                      exercise: exercise.exerciseName,
                    })}
                  />
                  <TouchableOpacity
                    style={[
                      styles.timerButton,
                      (!isPositiveNumber(exercise.actualRestSeconds) || hasActiveTimer) &&
                        styles.timerButtonDisabled,
                    ]}
                    disabled={!isPositiveNumber(exercise.actualRestSeconds) || hasActiveTimer}
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

            {exerciseIndex < exercises.length - 1 && exercise.restSeconds !== null && (
              <View style={[styles.dividerRow, { width: tableWidth }]}>
                <Text style={styles.dividerText}>
                  {t("workouts.detail.restAfterExercise", { seconds: exercise.restSeconds })}
                </Text>
                <TouchableOpacity
                  style={[styles.timerButton, hasActiveTimer && styles.timerButtonDisabled]}
                  disabled={hasActiveTimer}
                  onPress={() =>
                    onStartTimer(
                      exercise.restSeconds as number,
                      t("session.timerLabelBeforeNext", {
                        exercise: exercises[exerciseIndex + 1]?.exerciseName ?? "",
                      })
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("session.startTimer")}
                >
                  <Text style={styles.timerButtonText}>⏱</Text>
                </TouchableOpacity>
              </View>
            )}
          </Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerCell: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseNameCell: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  cell: {
    paddingHorizontal: spacing.xs,
  },
  cellTarget: {
    color: colors.accent,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  cellInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
  },
  // Stesso box model di cellInput (bordo 1 + padding sm), bordo trasparente
  // invece che colore bordo: senza questo il testo "corpo libero" era più
  // basso della TextInput adiacente (Set N/Recupero), che ha un bordo e un
  // padding che il semplice Text qui non replicava.
  bodyweightBox: {
    borderWidth: 1,
    borderColor: "transparent",
    padding: spacing.sm,
  },
  bodyweightText: {
    color: colors.text,
    fontSize: 12,
  },
  restInputRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  restInput: {
    flex: 1,
  },
  timerButton: {
    width: 32,
    height: 32,
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
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    // Stesso paddingHorizontal di .cell: senza questo il pulsante timer qui
    // finisce un po' più a destra di quello nella colonna Recupero della
    // riga sopra (quella cella ha un inset di spacing.xs, questa riga no).
    paddingHorizontal: spacing.xs,
  },
  // Pillola come in SessionExerciseCard.tsx (verticale) — stesso
  // .rest-divider della webapp: testo e bordo colore accento invece del
  // grigio muto usato per le altre etichette.
  dividerText: {
    flexShrink: 1,
    color: colors.accent,
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});

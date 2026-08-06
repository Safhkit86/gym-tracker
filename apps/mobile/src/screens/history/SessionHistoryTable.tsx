import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { SessionDetail } from "@gym-tracker/shared";
import { colors, spacing } from "../../theme/theme";
import { formatRestSeconds, formatWeight } from "../../utils/session-history-utils";

interface SessionHistoryTableProps {
  exercises: SessionDetail["exercises"];
  bodyweightLabel: string;
}

const EXERCISE_COL_WIDTH = 160;
const SET_COL_WIDTH = 64;
const KG_COL_WIDTH = 80;
const REST_COL_WIDTH = 90;

/** Vista tabellare per Storico su tablet — stessa tabella di
 *  apps/web/src/pages/SessionHistoryPage.tsx (Esercizio · Set 1…N · Kg ·
 *  Recupero), qui in sola lettura: nessun input, nessun pulsante timer,
 *  a differenza di SessionExerciseTable.tsx (Registra sessione). Niente
 *  griglia a bordi pieni — solo un filo sotto l'header e tra le righe,
 *  come .session-card th/td nella webapp: le colonne si distinguono per
 *  allineamento, non per linee verticali. Su telefono resta lo stack di
 *  righe attuale (SessionHistoryCard), mai questa tabella: usata solo
 *  quando il chiamante è già su un dispositivo tablet. */
export function SessionHistoryTable({ exercises, bodyweightLabel }: SessionHistoryTableProps) {
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
          <Text style={[styles.headerCell, styles.exerciseCol]}>{t("session.table.exercise")}</Text>
          {setIndexes.map((setIndex) => (
            <Text key={setIndex} style={[styles.headerCell, styles.setCol]}>
              {t("session.set", { number: setIndex + 1 })}
            </Text>
          ))}
          <Text style={[styles.headerCell, styles.kgCol]}>{t("session.weight")}</Text>
          <Text style={[styles.headerCell, styles.restCol]}>{t("session.rest")}</Text>
        </View>

        {exercises.map((exercise) => (
          <Fragment key={exercise.exerciseId}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.exerciseCol, styles.exerciseName]}>
                {exercise.exerciseName}
              </Text>
              {setIndexes.map((setIndex) => {
                const set = exercise.sets[setIndex];
                return (
                  <Text key={setIndex} style={[styles.cell, styles.setCol]}>
                    {set ? set.actualReps : "—"}
                  </Text>
                );
              })}
              <Text style={[styles.cell, styles.kgCol]}>
                {formatWeight(exercise, bodyweightLabel)}
              </Text>
              <Text style={[styles.cell, styles.restCol]}>{formatRestSeconds(exercise)}</Text>
            </View>
          </Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  headerCell: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cell: {
    color: colors.text,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  exerciseCol: {
    width: EXERCISE_COL_WIDTH,
  },
  exerciseName: {
    fontWeight: "700",
  },
  setCol: {
    width: SET_COL_WIDTH,
    textAlign: "right",
  },
  kgCol: {
    width: KG_COL_WIDTH,
    textAlign: "right",
  },
  restCol: {
    width: REST_COL_WIDTH,
    textAlign: "right",
  },
});

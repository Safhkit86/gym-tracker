import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { DashboardStats } from "@gym-tracker/shared";
import { HorizontalPeekCarousel } from "./HorizontalPeekCarousel";
import { colors, radius, spacing } from "../theme/theme";
import { formatItemIndicator } from "../utils/item-indicator";
import type { MuscleGroupSummary } from "../utils/muscle-groups";

function MuscleGroupTile({ mg, t }: { mg: MuscleGroupSummary; t: TFunction }) {
  return (
    <View style={styles.muscleGroupTile}>
      <Text style={styles.muscleGroupName}>{mg.muscleGroup}</Text>
      <View style={styles.muscleGroupRow}>
        <Text style={styles.muscleGroupRowLabel}>{t("dashboard.stats.sets")}</Text>
        <Text style={styles.muscleGroupRowValue}>{mg.setCount}</Text>
      </View>
      <View style={styles.muscleGroupRow}>
        <Text style={styles.muscleGroupRowLabel}>{t("dashboard.stats.reps")}</Text>
        <Text style={styles.muscleGroupRowValue}>{mg.repCount}</Text>
      </View>
    </View>
  );
}

/** Riepilogo statistiche (tile + volume per gruppo muscolare della
 *  settimana): condiviso tra Dashboard e Statistiche, stessi dati identici
 *  in entrambe — stessa logica di apps/web/src/components/StatisticheCard.tsx.
 *  Gruppi muscolari con swipe orizzontale (riquadri affiancati in riga come
 *  sulla webapp, nessun conflitto col scroll verticale della pagina). */
export function StatisticheCard({
  stats,
  muscleGroupVolume,
}: {
  stats: DashboardStats;
  muscleGroupVolume: MuscleGroupSummary[];
}) {
  const { t } = useTranslation();
  const [muscleIndex, setMuscleIndex] = useState(0);
  const firstGroup = muscleGroupVolume[0];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("dashboard.stats.title")}</Text>
      <View style={styles.statTiles}>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>{t("dashboard.stats.sessionCount")}</Text>
          <Text style={styles.statTileValue}>{stats.sessionCount}</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>{t("dashboard.stats.consecutiveWeeks")}</Text>
          <Text style={styles.statTileValue}>{stats.consecutiveWeeks}</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>{t("dashboard.stats.totalKgLifted")}</Text>
          <Text style={styles.statTileValue}>
            {stats.totalKgLifted.toLocaleString()} <Text style={styles.statTileUnit}>kg</Text>
          </Text>
        </View>
      </View>

      {firstGroup && (
        <View style={styles.muscleBlock}>
          <View style={styles.muscleBlockHeader}>
            <Text style={styles.cardSubtitle}>{t("dashboard.stats.muscleGroupsTitle")}</Text>
            {muscleGroupVolume.length > 1 && (
              <Text style={styles.indicator}>
                {formatItemIndicator(t, muscleIndex, muscleGroupVolume.length)}
              </Text>
            )}
          </View>
          {muscleGroupVolume.length > 1 ? (
            <HorizontalPeekCarousel
              items={muscleGroupVolume}
              keyExtractor={(mg) => mg.muscleGroup}
              onIndexChange={setMuscleIndex}
              renderItem={(mg) => <MuscleGroupTile mg={mg} t={t} />}
            />
          ) : (
            <MuscleGroupTile mg={firstGroup} t={t} />
          )}
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
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  indicator: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  statTiles: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statTile: {
    flex: 1,
    gap: spacing.xs,
  },
  statTileLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  statTileValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  statTileUnit: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textMuted,
  },
  muscleBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  muscleBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  muscleGroupTile: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  muscleGroupName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  muscleGroupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  muscleGroupRowLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  muscleGroupRowValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
});

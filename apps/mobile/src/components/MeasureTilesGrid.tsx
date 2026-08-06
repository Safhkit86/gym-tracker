import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Sparkline } from "./Sparkline";
import { colors, radius, spacing } from "../theme/theme";
import { fieldGridItemStyle, fieldGridStyle } from "../theme/layout";
import type { MeasureTileData } from "../utils/measurements";

interface MeasureTilesGridProps {
  tiles: MeasureTileData[];
}

/** Griglia di tile compatte (valore + delta + sparkline) per un riepilogo
 *  misure a colpo d'occhio — estratta dalla tile "Misure" di Dashboard
 *  perché la riusa anche il tab Misure di Statistiche su tablet (che
 *  prima mostrava un MiniLineChart a piena larghezza per campo, tutti
 *  impilati: su tablet, 2 grafici piccoli per riga usano lo spazio molto
 *  meglio dei 5 impilati). Riusa lo stesso pattern "griglia di campi"
 *  (fieldGridStyle/fieldGridItemStyle, minWidth invece di flexBasis) già
 *  in uso per MeasurementEntryCard e la tab Misure del Profilo, non un
 *  bucketing a colonne esplicite come ResponsiveCardColumns — con
 *  flexBasis percentuale, verificato sull'AVD, il wrap non avveniva
 *  sempre in modo affidabile a seconda della larghezza del container. */
export function MeasureTilesGrid({ tiles }: MeasureTilesGridProps) {
  const { t } = useTranslation();

  return (
    <View style={fieldGridStyle}>
      {tiles.map(({ field, values, current, delta }) => (
        <View style={[styles.tile, fieldGridItemStyle(2)]} key={field.key}>
          <Text style={styles.label}>{t(`history.measurements.${field.key}`)}</Text>
          <View style={styles.row}>
            <Text style={styles.value}>
              {current}
              <Text style={styles.unit}> {field.unit}</Text>
            </Text>
            {delta !== null && (
              <Text style={[styles.delta, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
              </Text>
            )}
          </View>
          <Sparkline values={values} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  unit: {
    fontSize: 11,
    fontWeight: "400",
    color: colors.textMuted,
  },
  delta: {
    fontSize: 11,
    fontWeight: "700",
  },
  deltaUp: {
    color: colors.accent,
  },
  deltaDown: {
    color: colors.danger,
  },
});

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MeasurementEntry } from "@gym-tracker/shared";
import { colors, radius, spacing } from "../../theme/theme";
import { fieldGridItemStyle, fieldGridStyle } from "../../theme/layout";
import { computeDelta, MEASUREMENT_FIELDS } from "../../utils/measurements";

const fieldStyle = fieldGridItemStyle(2);

interface MeasurementEntryCardProps {
  entry: MeasurementEntry;
  previous: MeasurementEntry | null;
  isDeleting: boolean;
  onRequestDelete: () => void;
}

export function MeasurementEntryCard({
  entry,
  previous,
  isDeleting,
  onRequestDelete,
}: MeasurementEntryCardProps) {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>
          {new Date(entry.measuredOn).toLocaleDateString(i18n.language)}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onRequestDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={t("history.deleteMeasurement")}
        >
          <Text style={styles.deleteButtonText}>{t("history.deleteMeasurement")}</Text>
        </TouchableOpacity>
      </View>

      <View style={fieldGridStyle}>
        {MEASUREMENT_FIELDS.map(({ key, unit }) => {
          const value = entry[key];
          const delta = computeDelta(previous?.[key] ?? null, value);
          return (
            <View key={key} style={fieldStyle}>
              <Text style={styles.fieldLabel}>{t(`history.measurements.${key}`)}</Text>
              <View style={styles.fieldValueRow}>
                <Text style={styles.fieldValue}>{value !== null ? `${value} ${unit}` : "—"}</Text>
                {delta !== null && (
                  <Text style={delta > 0 ? styles.deltaUp : styles.deltaDown}>
                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
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
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  date: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  fieldValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  fieldValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  deltaUp: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  deltaDown: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
});

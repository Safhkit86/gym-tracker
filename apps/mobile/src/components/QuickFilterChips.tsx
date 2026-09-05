import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../theme/theme";
import { QUICK_FILTER_PRESETS, type QuickFilterPreset } from "../utils/quick-filters";

interface QuickFilterChipsProps {
  value: QuickFilterPreset;
  onChange: (preset: QuickFilterPreset) => void;
}

/** Filtri rapidi periodo (1M/3M/1Y/5Y/Tutto) per Storico — equivalente RN di
 *  apps/web/src/components/QuickFilterChips.tsx. ScrollView orizzontale
 *  invece di un semplice row: su schermi stretti le 5 opzioni non ci
 *  starebbero tutte affiancate. */
export function QuickFilterChips({ value, onChange }: QuickFilterChipsProps) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t("history.quickFilter.accessibilityLabel")}
    >
      {QUICK_FILTER_PRESETS.map((preset) => (
        <TouchableOpacity
          key={preset.value}
          style={[styles.chip, preset.value === value && styles.chipActive]}
          onPress={() => onChange(preset.value)}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, preset.value === value && styles.chipTextActive]}>
            {t(preset.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.accentContrast,
  },
});

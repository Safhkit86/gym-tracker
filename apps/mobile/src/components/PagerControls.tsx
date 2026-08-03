import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

interface PagerControlsProps {
  start: number;
  pageSize: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Orizzontale (‹ ›) per liste in riga come i gruppi muscolari, verticale
   *  (↑ ↓) per liste verticali come gli esercizi. */
  orientation: "horizontal" | "vertical";
  prevLabel: string;
  nextLabel: string;
  /** "{{start}}–{{end}} di {{total}}" gia' interpolato dal chiamante (i18n),
   *  o "0 di 0" quando la lista e' vuota. */
  indicatorLabel: string;
}

/** Paginazione a frecce (mai scrollbar), stessa logica di
 *  apps/web/src/components/PagerControls.tsx — glifi testuali invece di
 *  un'icon library dedicata, stesso principio gia' usato altrove nell'app
 *  (es. i pulsanti ↑/↓ di ExerciseCard). */
export function PagerControls({
  canPrev,
  canNext,
  onPrev,
  onNext,
  orientation,
  prevLabel,
  nextLabel,
  indicatorLabel,
}: PagerControlsProps) {
  const prevGlyph = orientation === "horizontal" ? "‹" : "↑";
  const nextGlyph = orientation === "horizontal" ? "›" : "↓";

  return (
    <View style={[styles.pager, orientation === "vertical" && styles.pagerVertical]}>
      <TouchableOpacity
        style={[styles.button, !canPrev && styles.buttonDisabled]}
        onPress={onPrev}
        disabled={!canPrev}
        accessibilityRole="button"
        accessibilityLabel={prevLabel}
      >
        <Text style={styles.glyph}>{prevGlyph}</Text>
      </TouchableOpacity>
      <Text style={styles.indicator}>{indicatorLabel}</Text>
      <TouchableOpacity
        style={[styles.button, !canNext && styles.buttonDisabled]}
        onPress={onNext}
        disabled={!canNext}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
      >
        <Text style={styles.glyph}>{nextGlyph}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pagerVertical: {
    flexDirection: "column-reverse",
  },
  button: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  glyph: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  indicator: {
    color: colors.textMuted,
    fontSize: 11,
  },
});

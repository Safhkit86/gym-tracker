import { StyleSheet } from "react-native";
import { colors, radius, spacing } from "../../theme/theme";

/** Stili condivisi dagli stati di caricamento/errore/vuoto di
 *  CreateWorkoutScreen ed EditWorkoutScreen (entrambi avvolgono WorkoutForm). */
export const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
});

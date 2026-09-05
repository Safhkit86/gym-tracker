import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../theme/theme";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Controlli "Precedente/Successiva" + "Pagina X di Y" per le liste
 *  paginate lato server (Storico, Notifiche) — equivalente RN di
 *  apps/web/src/components/Pagination.tsx. Nulla se una sola pagina. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return null;
  }
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.button, page <= 1 && styles.buttonDisabled]}
        onPress={() => onPageChange(page - 1)}
        disabled={page <= 1}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("common.pagination.previous")}</Text>
      </TouchableOpacity>
      <Text style={styles.status}>{t("common.pagination.status", { page, totalPages })}</Text>
      <TouchableOpacity
        style={[styles.button, page >= totalPages && styles.buttonDisabled]}
        onPress={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("common.pagination.next")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  status: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

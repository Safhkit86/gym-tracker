import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../theme/theme";

interface PromptModalProps {
  visible: boolean;
  message: string;
  label: string;
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** Popup di conferma con un campo testo (es. nome della scheda duplicata).
 *  RN non ha un equivalente cross-platform di window.prompt (Alert.prompt
 *  esiste solo su iOS), da qui questo componente custom — stesso ruolo di
 *  apps/web/src/components/PromptDialog.tsx. */
export function PromptModal({
  visible,
  message,
  label,
  initialValue,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={label}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.create.cancel")}
            >
              <Text style={styles.cancelButtonText}>{t("workouts.create.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, !value.trim() && styles.confirmButtonDisabled]}
              onPress={() => onConfirm(value)}
              disabled={!value.trim()}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.detail.confirmYes")}
            >
              <Text style={styles.confirmButtonText}>{t("workouts.detail.confirmYes")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialog: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  message: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: colors.accentContrast,
    fontWeight: "700",
    fontSize: 14,
  },
});

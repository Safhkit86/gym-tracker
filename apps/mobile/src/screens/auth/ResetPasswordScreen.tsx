import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { resetPassword } from "../../api/auth";
import { translateError } from "../../api/translate-error";
import { colors, radius, spacing } from "../../theme/theme";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

/** Il token arriva come parametro di rotta, popolato dal deep link aperto
 *  dal link nell'email (vedi RootNavigator, config di linking) — non c'e'
 *  nessun altro modo per raggiungere questa schermata con un token valido.
 *  Se manca (rotta aperta senza deep link) si mostra un errore invece del
 *  form, stessa guardia della pagina web (apps/web/src/pages/
 *  ResetPasswordPage.tsx). */
export function ResetPasswordScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const token = route.params?.token ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("auth.resetPassword.passwordMismatch"));
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      navigation.reset({
        index: 0,
        routes: [{ name: "Login", params: { message: t("auth.resetPassword.success") } }],
      });
    } catch (err) {
      setError(translateError(err, t));
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <View style={styles.container}>
        <Text style={styles.error} accessibilityRole="alert">
          {t("auth.resetPassword.invalidLink")}
        </Text>
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
            accessibilityRole="button"
            accessibilityLabel={t("auth.resetPassword.requestNewLink")}
          >
            <Text style={styles.link}>{t("auth.resetPassword.requestNewLink")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("auth.resetPassword.title")}</Text>

      <Text style={styles.label}>{t("auth.resetPassword.newPassword")}</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t("auth.resetPassword.newPassword")}
      />

      <Text style={styles.label}>{t("auth.resetPassword.confirmPassword")}</Text>
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t("auth.resetPassword.confirmPassword")}
      />

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={t("auth.resetPassword.submit")}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.accentContrast} />
        ) : (
          <Text style={styles.buttonText}>{t("auth.resetPassword.submit")}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.accentContrast,
    fontWeight: "700",
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
  },
});

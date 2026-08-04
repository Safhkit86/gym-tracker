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
import { forgotPassword } from "../../api/auth";
import { translateError } from "../../api/translate-error";
import { colors, radius, spacing } from "../../theme/theme";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await forgotPassword({ email });
      setMessage(result.message);
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("auth.forgotPassword.title")}</Text>

      {message ? (
        <Text style={styles.status} accessibilityRole="alert">
          {message}
        </Text>
      ) : (
        <>
          <Text style={styles.subtitle}>{t("auth.forgotPassword.subtitle")}</Text>

          <Text style={styles.label}>{t("auth.forgotPassword.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t("auth.forgotPassword.email")}
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
            accessibilityLabel={t("auth.forgotPassword.submit")}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.accentContrast} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.forgotPassword.submit")}</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          accessibilityRole="button"
          accessibilityLabel={t("auth.forgotPassword.backToLogin")}
        >
          <Text style={styles.link}>{t("auth.forgotPassword.backToLogin")}</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
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
  status: {
    color: colors.accent,
    fontSize: 14,
    marginBottom: spacing.xl,
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

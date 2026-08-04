import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import { translateError } from "../../api/translate-error";
import { colors, radius, spacing } from "../../theme/theme";
import { CenteredContent } from "../../components/CenteredContent";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password);
      // Come in LoginScreen: RootNavigator reagisce da solo al nuovo token.
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <CenteredContent style={styles.content}>
          <Text style={styles.title}>{t("auth.register.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.register.subtitle")}</Text>

          <Text style={styles.label}>{t("auth.register.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t("auth.register.email")}
          />

          <Text style={styles.label}>{t("auth.register.password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t("auth.register.password")}
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
            accessibilityLabel={t("auth.register.submit")}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.accentContrast} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.register.submit")}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("auth.register.haveAccount")} </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              accessibilityRole="button"
              accessibilityLabel={t("auth.register.loginLink")}
            >
              <Text style={styles.link}>{t("auth.register.loginLink")}</Text>
            </TouchableOpacity>
          </View>
        </CenteredContent>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: spacing.xl,
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
  footerText: {
    color: colors.textMuted,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
  },
});

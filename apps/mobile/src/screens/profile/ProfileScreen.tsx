import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { AccountPreferences, ProgressionPreferences } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { confirmPasswordChange, requestPasswordChange } from "../../api/auth";
import {
  getAccountPreferences,
  getMeasurements,
  getProgressionPreferences,
  updateAccountPreferences,
  updateMeasurements,
  updateProgressionPreferences,
} from "../../api/profile";
import { ApiRequestError } from "../../api/client";
import { translateError } from "../../api/translate-error";
import { colors, radius, spacing } from "../../theme/theme";

type ProfileTab = "account" | "measurements" | "preferences";

/** Nullable o maggiore di zero: 0 (o un negativo, impedito gia' da
 *  keyboardType="numeric") non e' una misura valida, va trattato come "non
 *  impostata" invece di essere inviato al server e farsi respingere con un
 *  errore. Stessa logica di apps/web/src/pages/ProfilePage.tsx. */
function parseMeasurement(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return parsed > 0 ? parsed : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { token, user } = useAuth();
  const [tab, setTab] = useState<ProfileTab>("measurements");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [armCm, setArmCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [legCm, setLegCm] = useState("");
  const [measuredOn, setMeasuredOn] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [measurementsLoaded, setMeasurementsLoaded] = useState(false);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [measurementsMessage, setMeasurementsMessage] = useState<string | null>(null);
  const [isSavingMeasurements, setIsSavingMeasurements] = useState(false);

  const [requiredConsecutiveSessions, setRequiredConsecutiveSessions] = useState("2");
  const [groupingScope, setGroupingScope] =
    useState<ProgressionPreferences["groupingScope"]>("workout");
  const [prefillScope, setPrefillScope] = useState<AccountPreferences["prefillScope"]>("workout");
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(false);
  const [historicizeMeasurements, setHistoricizeMeasurements] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    Promise.all([getProgressionPreferences(token), getAccountPreferences(token)])
      .then(([progression, account]) => {
        setRequiredConsecutiveSessions(String(progression.requiredConsecutiveSessions));
        setGroupingScope(progression.groupingScope);
        setPrefillScope(account.prefillScope);
        setTimerSoundEnabled(account.timerSoundEnabled);
        setHistoricizeMeasurements(account.historicizeMeasurements);
        setPreferencesLoaded(true);
      })
      .catch((err: unknown) => {
        setPreferencesError(
          err instanceof ApiRequestError ? err.message : t("profile.preferences.loadError")
        );
      });
  }, [token, t]);

  useEffect(() => {
    if (!token) {
      return;
    }
    getMeasurements(token)
      .then((data) => {
        setHeightCm(data.heightCm !== null ? String(data.heightCm) : "");
        setWeightKg(data.weightKg !== null ? String(data.weightKg) : "");
        setChestCm(data.chestCm !== null ? String(data.chestCm) : "");
        setArmCm(data.armCm !== null ? String(data.armCm) : "");
        setWaistCm(data.waistCm !== null ? String(data.waistCm) : "");
        setLegCm(data.legCm !== null ? String(data.legCm) : "");
        setMeasurementsLoaded(true);
      })
      .catch((err: unknown) => {
        setMeasurementsError(
          err instanceof ApiRequestError ? err.message : t("profile.measurements.loadError")
        );
      });
  }, [token, t]);

  async function handleSaveMeasurements(): Promise<void> {
    setMeasurementsError(null);
    setMeasurementsMessage(null);
    if (!token) {
      return;
    }
    setIsSavingMeasurements(true);
    try {
      const [result] = await Promise.all([
        updateMeasurements(token, {
          heightCm: parseMeasurement(heightCm),
          weightKg: parseMeasurement(weightKg),
          chestCm: parseMeasurement(chestCm),
          armCm: parseMeasurement(armCm),
          waistCm: parseMeasurement(waistCm),
          legCm: parseMeasurement(legCm),
          measuredOn: historicizeMeasurements ? measuredOn : undefined,
        }),
        updateAccountPreferences(token, {
          prefillScope,
          timerSoundEnabled,
          historicizeMeasurements,
        }),
      ]);
      setHeightCm(result.heightCm !== null ? String(result.heightCm) : "");
      setWeightKg(result.weightKg !== null ? String(result.weightKg) : "");
      setChestCm(result.chestCm !== null ? String(result.chestCm) : "");
      setArmCm(result.armCm !== null ? String(result.armCm) : "");
      setWaistCm(result.waistCm !== null ? String(result.waistCm) : "");
      setLegCm(result.legCm !== null ? String(result.legCm) : "");
      setMeasurementsMessage(
        historicizeMeasurements
          ? t("profile.measurements.savedWithDate", {
              date: new Date(`${measuredOn}T00:00:00`).toLocaleDateString(i18n.language),
            })
          : t("profile.measurements.saved")
      );
    } catch (err) {
      setMeasurementsError(
        err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
      );
    } finally {
      setIsSavingMeasurements(false);
    }
  }

  async function handleSavePreferences(): Promise<void> {
    setPreferencesError(null);
    setPreferencesMessage(null);
    if (!token) {
      return;
    }
    setIsSavingPreferences(true);
    try {
      const [progressionResult, accountResult] = await Promise.all([
        updateProgressionPreferences(token, {
          requiredConsecutiveSessions: Number(requiredConsecutiveSessions),
          groupingScope,
        }),
        updateAccountPreferences(token, {
          prefillScope,
          timerSoundEnabled,
          historicizeMeasurements,
        }),
      ]);
      setRequiredConsecutiveSessions(String(progressionResult.requiredConsecutiveSessions));
      setGroupingScope(progressionResult.groupingScope);
      setPrefillScope(accountResult.prefillScope);
      setTimerSoundEnabled(accountResult.timerSoundEnabled);
      setHistoricizeMeasurements(accountResult.historicizeMeasurements);
      setPreferencesMessage(t("profile.preferences.saved"));
    } catch (err) {
      setPreferencesError(
        err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
      );
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function handleRequestPasswordChange(): Promise<void> {
    setAccountError(null);
    setAccountMessage(null);
    if (newPassword !== confirmNewPassword) {
      setAccountError(t("profile.account.passwordMismatch"));
      return;
    }
    if (!token) {
      return;
    }
    setIsSavingAccount(true);
    try {
      const result = await requestPasswordChange(token, { currentPassword, newPassword });
      setAccountMessage(result.message);
      setAwaitingOtp(true);
    } catch (err) {
      setAccountError(translateError(err, t));
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleConfirmPasswordChange(): Promise<void> {
    setAccountError(null);
    if (!token) {
      return;
    }
    setIsSavingAccount(true);
    try {
      const result = await confirmPasswordChange(token, { otp });
      setAccountMessage(result.message);
      setAwaitingOtp(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setOtp("");
    } catch (err) {
      setAccountError(translateError(err, t));
    } finally {
      setIsSavingAccount(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "account" && styles.tabButtonActive]}
          onPress={() => setTab("account")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.account.tab")}
        >
          <Text style={[styles.tabButtonText, tab === "account" && styles.tabButtonTextActive]}>
            {t("profile.account.tab")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "measurements" && styles.tabButtonActive]}
          onPress={() => setTab("measurements")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.measurementsTab")}
        >
          <Text
            style={[styles.tabButtonText, tab === "measurements" && styles.tabButtonTextActive]}
          >
            {t("profile.measurementsTab")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "preferences" && styles.tabButtonActive]}
          onPress={() => setTab("preferences")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.preferencesTab")}
        >
          <Text style={[styles.tabButtonText, tab === "preferences" && styles.tabButtonTextActive]}>
            {t("profile.preferencesTab")}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "account" && (
        <View style={styles.card}>
          {accountError && (
            <Text style={styles.error} accessibilityRole="alert">
              {accountError}
            </Text>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t("profile.account.emailLabel")}</Text>
            <Text style={styles.infoText}>{user?.email}</Text>
          </View>
          {user && (
            <View style={styles.field}>
              <Text style={styles.label}>{t("profile.account.memberSince")}</Text>
              <Text style={styles.infoText}>
                {new Date(user.createdAt).toLocaleDateString(i18n.language)}
              </Text>
            </View>
          )}

          <Text style={styles.toggleHint}>{t("profile.account.securityIntro")}</Text>

          {!awaitingOtp && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.account.currentPassword")}</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t("profile.account.currentPassword")}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.account.newPassword")}</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t("profile.account.newPassword")}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.account.confirmNewPassword")}</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t("profile.account.confirmNewPassword")}
                />
              </View>
              {accountMessage && (
                <Text style={styles.successText} accessibilityRole="alert">
                  {accountMessage}
                </Text>
              )}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRequestPasswordChange}
                disabled={isSavingAccount}
                accessibilityRole="button"
                accessibilityLabel={t("profile.account.requestSubmit")}
              >
                <Text style={styles.submitButtonText}>
                  {isSavingAccount
                    ? t("profile.account.requestSubmitting")
                    : t("profile.account.requestSubmit")}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {awaitingOtp && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.account.otpLabel")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={otp}
                  onChangeText={setOtp}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t("profile.account.otpLabel")}
                />
              </View>
              {accountMessage && (
                <Text style={styles.successText} accessibilityRole="alert">
                  {accountMessage}
                </Text>
              )}
              <View style={styles.otpActions}>
                <TouchableOpacity
                  style={[styles.submitButton, styles.otpConfirmButton]}
                  onPress={handleConfirmPasswordChange}
                  disabled={isSavingAccount}
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.account.otpSubmit")}
                >
                  <Text style={styles.submitButtonText}>
                    {isSavingAccount
                      ? t("profile.account.otpSubmitting")
                      : t("profile.account.otpSubmit")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setAwaitingOtp(false);
                    setAccountMessage(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.account.cancel")}
                >
                  <Text style={styles.cancelButtonText}>{t("profile.account.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {tab === "measurements" && (
        <View style={styles.card}>
          {measurementsError && (
            <Text style={styles.error} accessibilityRole="alert">
              {measurementsError}
            </Text>
          )}
          {!measurementsLoaded && !measurementsError && (
            <Text style={styles.infoText}>{t("common.loading")}</Text>
          )}
          {measurementsLoaded && preferencesLoaded && (
            <>
              <View style={styles.toggleRow}>
                <Switch
                  value={historicizeMeasurements}
                  onValueChange={setHistoricizeMeasurements}
                  trackColor={{ true: colors.accent, false: colors.border }}
                />
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>
                    {t("profile.measurements.historicizeLabel")}
                  </Text>
                  <Text style={styles.toggleHint}>{t("profile.measurements.historicizeHint")}</Text>
                </View>
              </View>

              {historicizeMeasurements && (
                <View style={styles.field}>
                  <Text style={styles.label}>{t("profile.measurements.date")}</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.measurements.date")}
                  >
                    <Text style={styles.dateButtonText}>
                      {new Date(`${measuredOn}T00:00:00`).toLocaleDateString(i18n.language)}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={new Date(`${measuredOn}T00:00:00`)}
                      mode="date"
                      maximumDate={new Date()}
                      onChange={(_event, date) => {
                        setShowDatePicker(false);
                        if (date) {
                          setMeasuredOn(date.toISOString().slice(0, 10));
                        }
                      }}
                    />
                  )}
                  <Text style={styles.hint}>{t("profile.measurements.dateHint")}</Text>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.measurements.height")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.measurements.weight")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={weightKg}
                  onChangeText={setWeightKg}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.measurements.chest")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={chestCm}
                  onChangeText={setChestCm}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.measurements.arm")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={armCm}
                  onChangeText={setArmCm}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.measurements.waist")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={waistCm}
                  onChangeText={setWaistCm}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.measurements.leg")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={legCm}
                  onChangeText={setLegCm}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {measurementsMessage && (
                <Text style={styles.successText} accessibilityRole="alert">
                  {measurementsMessage}
                </Text>
              )}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSaveMeasurements}
                disabled={isSavingMeasurements}
                accessibilityRole="button"
                accessibilityLabel={t("profile.measurements.save")}
              >
                <Text style={styles.submitButtonText}>
                  {isSavingMeasurements
                    ? t("profile.measurements.saving")
                    : t("profile.measurements.save")}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {tab === "preferences" && (
        <View style={styles.card}>
          {preferencesError && (
            <Text style={styles.error} accessibilityRole="alert">
              {preferencesError}
            </Text>
          )}
          {!preferencesLoaded && !preferencesError && (
            <Text style={styles.infoText}>{t("common.loading")}</Text>
          )}
          {preferencesLoaded && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.preferences.requiredSessionsLabel")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={requiredConsecutiveSessions}
                  onChangeText={setRequiredConsecutiveSessions}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.preferences.groupingScopeLabel")}</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={groupingScope}
                    onValueChange={(value: ProgressionPreferences["groupingScope"]) =>
                      setGroupingScope(value)
                    }
                    style={styles.picker}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label={t("profile.preferences.scopeWorkout")} value="workout" />
                    <Picker.Item label={t("profile.preferences.scopeExercise")} value="exercise" />
                  </Picker>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("profile.preferences.prefillScopeLabel")}</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={prefillScope}
                    onValueChange={(value: AccountPreferences["prefillScope"]) =>
                      setPrefillScope(value)
                    }
                    style={styles.picker}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label={t("profile.preferences.scopeWorkout")} value="workout" />
                    <Picker.Item label={t("profile.preferences.scopeExercise")} value="exercise" />
                  </Picker>
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Switch
                  value={timerSoundEnabled}
                  onValueChange={setTimerSoundEnabled}
                  trackColor={{ true: colors.accent, false: colors.border }}
                />
                <Text style={styles.toggleTitle}>{t("profile.preferences.timerSoundLabel")}</Text>
              </View>

              {preferencesMessage && (
                <Text style={styles.successText} accessibilityRole="alert">
                  {preferencesMessage}
                </Text>
              )}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSavePreferences}
                disabled={isSavingPreferences}
                accessibilityRole="button"
                accessibilityLabel={t("profile.preferences.save")}
              >
                <Text style={styles.submitButtonText}>
                  {isSavingPreferences
                    ? t("profile.preferences.saving")
                    : t("profile.preferences.save")}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: colors.accentContrast,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
  successText: {
    color: colors.accent,
    fontSize: 13,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
  },
  dateButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  dateButtonText: {
    color: colors.text,
    fontWeight: "600",
  },
  pickerWrapper: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  picker: {
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  submitButtonText: {
    color: colors.accentContrast,
    fontSize: 14,
    fontWeight: "700",
  },
  otpActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  otpConfirmButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});

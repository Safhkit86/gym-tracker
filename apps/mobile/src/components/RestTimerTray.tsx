import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../theme/theme";
import type { RestTimer } from "../hooks/useRestTimers";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface RestTimerTrayProps {
  timers: RestTimer[];
  onCancel: (id: string) => void;
  onSnooze: (id: string) => void;
}

/** Widget dei timer di recupero attivi: fisso in basso, impilato se piu' di
 *  uno, sempre visibile durante lo scroll di Registra sessione — stesso
 *  ruolo di apps/web/src/components/RestTimerTray.tsx. */
export function RestTimerTray({ timers, onCancel, onSnooze }: RestTimerTrayProps) {
  const { t } = useTranslation();

  if (timers.length === 0) {
    return null;
  }

  return (
    <View style={styles.tray} pointerEvents="box-none">
      {timers.map((timer) => (
        <View
          key={timer.id}
          style={[styles.timer, timer.status === "ringing" && styles.timerRinging]}
        >
          <View style={styles.info}>
            <Text style={styles.label} numberOfLines={1}>
              {timer.label}
            </Text>
            <Text style={styles.time}>
              {timer.status === "ringing"
                ? t("session.timerRinging")
                : formatCountdown(timer.remainingSeconds)}
            </Text>
          </View>
          {timer.status === "running" ? (
            <TouchableOpacity
              style={styles.button}
              onPress={() => onCancel(timer.id)}
              accessibilityRole="button"
              accessibilityLabel={t("session.timerCancel")}
            >
              <Text style={styles.buttonText}>{t("session.timerCancel")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={() => onSnooze(timer.id)}
              accessibilityRole="button"
              accessibilityLabel={t("session.timerStop")}
            >
              <Text style={styles.buttonText}>{t("session.timerStop")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  timerRinging: {
    borderColor: colors.warning,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  time: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  buttonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
});

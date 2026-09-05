import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { Notification, Paginated, ProgressionDefault } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { useUnreadCount } from "../../notifications/useUnreadCount";
import {
  acceptNotification,
  listNotifications,
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications";
import { acceptProgressionDefaults } from "../../api/profile";
import { ApiRequestError } from "../../api/client";
import { formatSuggestionDelta, toOverride } from "../../utils/suggestion-format";
import { colors, radius, spacing } from "../../theme/theme";
import { centeredContentStyle } from "../../theme/layout";
import { useSafeAreaHorizontalPadding } from "../../hooks/useResponsiveLayout";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { NotificationsStackParamList } from "../../navigation/NotificationsNavigator";
import { Pagination } from "../../components/Pagination";

type Props = NativeStackScreenProps<NotificationsStackParamList, "NotificationsHome">;

/** Stesso valore del default lato server — vedi il commento analogo in
 *  HistoryScreen.tsx/apps/web/src/pages/NotificationsPage.tsx. */
const NOTIFICATIONS_PAGE_SIZE = 20;

export function NotificationsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { refreshUnreadCount } = useUnreadCount();
  const safeAreaPadding = useSafeAreaHorizontalPadding();
  // Elenco completo, non paginato: serve SOLO per "Accetta tutte le
  // progressioni" (deve considerare ogni notifica non letta dell'utente, non
  // solo quelle della pagina visibile) e per "hasUnread" sotto. L'elenco
  // mostrato a schermo viene invece da notificationsPage (paginato).
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [notificationsPage, setNotificationsPage] = useState<Paginated<Notification> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const [full, paged] = await Promise.all([
        listNotifications(token),
        listNotificationsPage(token, { page, pageSize: NOTIFICATIONS_PAGE_SIZE }),
      ]);
      setNotifications(full);
      setNotificationsPage(paged);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
    }
  }, [token, page, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Rifà il fetch anche al ritorno in primo piano, non solo al mount —
  // senza, tornare su Notifiche dopo aver accettato o letto un
  // suggerimento altrove (es. Dashboard) mostrava ancora l'elenco caricato
  // al mount, con lo stesso suggerimento ancora "da accettare" — riportato
  // dall'utente. Vedi useRefreshOnFocus per il perché non useFocusEffect.
  useRefreshOnFocus(navigation, refresh);

  async function handleMarkRead(id: string): Promise<void> {
    if (!token) {
      return;
    }
    try {
      await markNotificationRead(token, id);
      await refresh();
      refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("notifications.markReadError"));
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    if (!token) {
      return;
    }
    try {
      await markAllNotificationsRead(token);
      await refresh();
      refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("notifications.markAllReadError"));
    }
  }

  async function handleAccept(notification: Notification): Promise<void> {
    if (!token) {
      return;
    }
    const override = toOverride(notification);
    if (!override) {
      return;
    }
    try {
      await acceptProgressionDefaults(token, [override]);
      await acceptNotification(token, notification.id);
      await refresh();
      refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("notifications.acceptError"));
    }
  }

  async function handleAcceptAll(): Promise<void> {
    if (!token || !notifications) {
      return;
    }
    const overrides = notifications
      .filter((n) => n.readAt === null)
      .map(toOverride)
      .filter((o): o is ProgressionDefault => o !== null);
    if (overrides.length === 0) {
      return;
    }
    try {
      await acceptProgressionDefaults(token, overrides);
      await markAllNotificationsRead(token);
      await refresh();
      refreshUnreadCount();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("notifications.acceptAllError"));
    }
  }

  const hasUnread = notifications?.some((n) => n.readAt === null) ?? false;

  return (
    <ScrollView style={[styles.container, safeAreaPadding]} contentContainerStyle={styles.content}>
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {notifications === null && !error && (
        <Text style={styles.infoText}>{t("common.loading")}</Text>
      )}
      {notifications?.length === 0 && (
        <Text style={styles.infoText}>{t("notifications.empty")}</Text>
      )}

      {hasUnread && (
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleAcceptAll}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.acceptAll")}
          >
            <Text style={styles.secondaryButtonText}>{t("notifications.acceptAll")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleMarkAllRead}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.markAllRead")}
          >
            <Text style={styles.secondaryButtonText}>{t("notifications.markAllRead")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {notificationsPage?.items?.map((notification) => {
        const isUnread = notification.readAt === null;
        const delta = formatSuggestionDelta(notification, t("dashboard.suggestions.repsUnit"));
        return (
          <View key={notification.id} style={[styles.card, isUnread && styles.cardUnread]}>
            <Text style={styles.cardTitle}>{notification.exerciseName}</Text>
            <Text style={styles.reasonText}>{notification.reason}</Text>
            {delta !== "" && <Text style={styles.deltaText}>{delta}</Text>}
            <Text style={styles.metaText}>
              {new Date(notification.createdAt).toLocaleString(i18n.language)}
            </Text>
            {isUnread && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAccept(notification)}
                  accessibilityRole="button"
                  accessibilityLabel={t("dashboard.suggestions.accept")}
                >
                  <Text style={styles.acceptButtonText}>{t("dashboard.suggestions.accept")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleMarkRead(notification.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("notifications.markRead")}
                >
                  <Text style={styles.secondaryButtonText}>{t("notifications.markRead")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {notificationsPage && (
        <Pagination
          page={notificationsPage.page}
          pageSize={notificationsPage.pageSize}
          total={notificationsPage.total}
          onPageChange={setPage}
        />
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
    ...centeredContentStyle,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardUnread: {
    borderColor: colors.accent,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  reasonText: {
    color: colors.text,
    fontSize: 13,
  },
  deltaText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  acceptButtonText: {
    color: colors.accentContrast,
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});

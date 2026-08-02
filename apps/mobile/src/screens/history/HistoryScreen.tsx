import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MeasurementEntry, SessionDetail } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { deleteSession, listSessions } from "../../api/sessions";
import { deleteMeasurement, listMeasurements } from "../../api/measurements";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import { computeWeekNumbers } from "../../utils/session-history-utils";
import { SessionHistoryCard } from "./SessionHistoryCard";
import { MeasurementEntryCard } from "./MeasurementEntryCard";

type HistoryTab = "sessions" | "measurements";
type SortOrder = "desc" | "asc";

export function HistoryScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [tab, setTab] = useState<HistoryTab>("sessions");

  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const [measurements, setMeasurements] = useState<MeasurementEntry[] | null>(null);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    listSessions(token)
      .then((result) => {
        if (!cancelled) {
          setSessions(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  // Caricamento lazy: solo alla prima apertura della vista Misure, non
  // insieme alle sessioni (stesso motivo di apps/web/src/pages/SessionHistoryPage.tsx).
  useEffect(() => {
    if (!token || tab !== "measurements" || measurements !== null) {
      return;
    }
    let cancelled = false;
    listMeasurements(token)
      .then((result) => {
        if (!cancelled) {
          setMeasurements(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMeasurementsError(
            err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, tab, measurements, t]);

  function requestDeleteSession(id: string): void {
    Alert.alert(t("history.deleteSessionConfirmTitle"), undefined, [
      { text: t("workouts.create.cancel"), style: "cancel" },
      {
        text: t("history.deleteSession"),
        style: "destructive",
        onPress: () => {
          if (!token) {
            return;
          }
          setDeletingSessionId(id);
          deleteSession(token, id)
            .then(() => {
              setSessions((current) => current?.filter((s) => s.id !== id) ?? current);
            })
            .catch((err: unknown) => {
              setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
            })
            .finally(() => setDeletingSessionId(null));
        },
      },
    ]);
  }

  function requestDeleteMeasurement(id: string): void {
    Alert.alert(t("history.deleteMeasurementConfirmTitle"), undefined, [
      { text: t("workouts.create.cancel"), style: "cancel" },
      {
        text: t("history.deleteMeasurement"),
        style: "destructive",
        onPress: () => {
          if (!token) {
            return;
          }
          setDeletingMeasurementId(id);
          deleteMeasurement(token, id)
            .then(() => {
              setMeasurements((current) => current?.filter((m) => m.id !== id) ?? current);
            })
            .catch((err: unknown) => {
              setMeasurementsError(
                err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
              );
            })
            .finally(() => setDeletingMeasurementId(null));
        },
      },
    ]);
  }

  const orderedSessions = sessions && sortOrder === "asc" ? [...sessions].reverse() : sessions;
  const weekBySessionId = sessions ? computeWeekNumbers(sessions) : null;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "sessions" && styles.tabButtonActive]}
          onPress={() => setTab("sessions")}
          accessibilityRole="button"
          accessibilityLabel={t("history.sessionsTab")}
        >
          <Text style={[styles.tabButtonText, tab === "sessions" && styles.tabButtonTextActive]}>
            {t("history.sessionsTab")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "measurements" && styles.tabButtonActive]}
          onPress={() => setTab("measurements")}
          accessibilityRole="button"
          accessibilityLabel={t("history.measurementsTab")}
        >
          <Text
            style={[styles.tabButtonText, tab === "measurements" && styles.tabButtonTextActive]}
          >
            {t("history.measurementsTab")}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "sessions" ? (
        <FlatList
          data={orderedSessions ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {error && (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              )}
              {sessions === null && !error && (
                <Text style={styles.infoText}>{t("common.loading")}</Text>
              )}
              {sessions?.length === 0 && (
                <Text style={styles.infoText}>{t("history.noSessions")}</Text>
              )}
              {orderedSessions && orderedSessions.length > 0 && (
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={() => setSortOrder((current) => (current === "desc" ? "asc" : "desc"))}
                  accessibilityRole="button"
                  accessibilityLabel={t("history.sortToggle")}
                >
                  <Text style={styles.sortButtonText}>
                    {sortOrder === "desc"
                      ? `↓ ${t("history.sortDesc")}`
                      : `↑ ${t("history.sortAsc")}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const week = weekBySessionId?.get(item.id);
            const previousSession = index > 0 ? (orderedSessions?.[index - 1] ?? null) : null;
            const previousWeek = previousSession
              ? weekBySessionId?.get(previousSession.id)
              : undefined;
            const isNewWeek = week !== undefined && week !== previousWeek;
            return (
              <SessionHistoryCard
                session={item}
                week={week}
                isNewWeek={isNewWeek}
                isDeleting={deletingSessionId === item.id}
                onRequestDelete={() => requestDeleteSession(item.id)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={measurements ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {measurementsError && (
                <Text style={styles.error} accessibilityRole="alert">
                  {measurementsError}
                </Text>
              )}
              {measurements === null && !measurementsError && (
                <Text style={styles.infoText}>{t("common.loading")}</Text>
              )}
              {measurements?.length === 0 && (
                <Text style={styles.infoText}>{t("history.noMeasurements")}</Text>
              )}
              {measurements && measurements.length > 0 && (
                <Text style={styles.sectionNote}>{t("history.measurementsNote")}</Text>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <MeasurementEntryCard
              entry={item}
              previous={measurements?.[index + 1] ?? null}
              isDeleting={deletingMeasurementId === item.id}
              onRequestDelete={() => requestDeleteMeasurement(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: 0,
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
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    padding: spacing.lg,
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
    fontSize: 14,
  },
  sortButton: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sortButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionNote: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

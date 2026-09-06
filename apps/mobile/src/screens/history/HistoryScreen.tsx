import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { MeasurementEntry, Paginated, SessionDetail } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import { deleteSession, listSessions, listSessionsPage } from "../../api/sessions";
import { deleteMeasurement, listMeasurements, listMeasurementsPage } from "../../api/measurements";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import { centeredContentStyle } from "../../theme/layout";
import { useIsTabletDevice, useSafeAreaHorizontalPadding } from "../../hooks/useResponsiveLayout";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { HistoryStackParamList } from "../../navigation/HistoryNavigator";
import { computeWeekNumbers } from "../../utils/session-history-utils";
import { findPreviousMeasurement } from "../../utils/measurements";
import { sinceForQuickFilter, type QuickFilterPreset } from "../../utils/quick-filters";
import { Pagination } from "../../components/Pagination";
import { QuickFilterChips } from "../../components/QuickFilterChips";
import { SessionHistoryCard } from "./SessionHistoryCard";
import { MeasurementEntryCard } from "./MeasurementEntryCard";

type HistoryTab = "sessions" | "measurements";
type SortOrder = "desc" | "asc";

/** Stesso valore del default lato server, copiato qui invece che importato
 *  da @gym-tracker/shared — vedi il commento analogo in
 *  apps/web/src/pages/SessionHistoryPage.tsx: un import "value" (non "type")
 *  dal barrel condiviso trascinerebbe anche le dipendenze solo-Node di
 *  amqp-connection.ts/mailer.ts, non testato se Metro le gestirebbe meglio
 *  di Vite ma non vale la pena rischiarlo per una singola costante. */
const HISTORY_PAGE_SIZE = 20;

export type Props = NativeStackScreenProps<HistoryStackParamList, "HistoryHome">;

export function HistoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [tab, setTab] = useState<HistoryTab>("sessions");
  const safeAreaPadding = useSafeAreaHorizontalPadding();
  // Su tablet la card di sessione mostra una tabella (SessionHistoryTable):
  // la card stessa si dimensiona sul contenuto (vedi SessionHistoryCard),
  // qui basta non applicare il cap+centra della colonna singola al
  // contenitore della lista, altrimenti limiterebbe anche le sessioni con
  // molti set prima che possa farlo la card in base al proprio contenuto —
  // il tab Misure invece resta cap+centrato in entrambi i casi (non
  // coinvolto da questa modifica).
  const isTablet = useIsTabletDevice();

  // Storico completo, non paginato: serve SOLO per numerare le settimane
  // (richiede l'ordine cronologico intero). Le card mostrate a schermo
  // vengono invece da sessionsPage sotto (fetch paginato lato server).
  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [sessionsPage, setSessionsPage] = useState<Paginated<SessionDetail> | null>(null);
  const [page, setPage] = useState(1);
  const [quickFilter, setQuickFilter] = useState<QuickFilterPreset>("all");
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Stesso schema delle sessioni: measurements e' il totale non paginato
  // (nessun uso analogo all'export della webapp qui, ma comunque utile ad
  // eventuali calcoli futuri sull'intero storico), measurementsPage la
  // fetta mostrata a schermo.
  const [measurements, setMeasurements] = useState<MeasurementEntry[] | null>(null);
  const [measurementsPage, setMeasurementsPage] = useState<Paginated<MeasurementEntry> | null>(
    null
  );
  const [measurementsPageNumber, setMeasurementsPageNumber] = useState(1);
  const [measurementsQuickFilter, setMeasurementsQuickFilter] = useState<QuickFilterPreset>("all");
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await listSessions(token);
      if (isMountedRef.current) {
        setSessions(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
      }
    }
  }, [token, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const loadSessionsPage = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await listSessionsPage(token, {
        page,
        pageSize: HISTORY_PAGE_SIZE,
        since: sinceForQuickFilter(quickFilter),
        order: sortOrder,
      });
      if (isMountedRef.current) {
        setSessionsPage(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
      }
    }
  }, [token, page, quickFilter, sortOrder, t]);

  useEffect(() => {
    void loadSessionsPage();
  }, [loadSessionsPage]);

  const loadMeasurements = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await listMeasurements(token);
      if (isMountedRef.current) {
        setMeasurements(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setMeasurementsError(
          err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
        );
      }
    }
  }, [token, t]);

  const loadMeasurementsPage = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const result = await listMeasurementsPage(token, {
        page: measurementsPageNumber,
        pageSize: HISTORY_PAGE_SIZE,
        since: sinceForQuickFilter(measurementsQuickFilter),
      });
      if (isMountedRef.current) {
        setMeasurementsPage(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setMeasurementsError(
          err instanceof ApiRequestError ? err.message : t("common.errorUnexpected")
        );
      }
    }
  }, [token, measurementsPageNumber, measurementsQuickFilter, t]);

  // Caricamento lazy: solo alla prima apertura del tab Misure, non insieme
  // alle sessioni (stesso motivo di
  // apps/web/src/pages/SessionHistoryPage.tsx) — ma rifatto ogni volta che
  // si passa al tab, non solo la prima (guard "measurements !== null"
  // rimosso), cosi' una misura salvata altrove compare tornando qui.
  useEffect(() => {
    if (tab === "measurements") {
      void loadMeasurements();
      void loadMeasurementsPage();
    }
  }, [tab, loadMeasurements, loadMeasurementsPage]);

  // Rifà il fetch anche al ritorno in primo piano sulla schermata (non
  // solo al mount): una sessione loggata o una misura salvata altrove non
  // comparivano tornando qui finche' non si smontava/rimontava la
  // schermata a mano, cosa che con il tab/sidebar di navigazione non
  // accade quasi mai — riportato dall'utente. Vedi useRefreshOnFocus.
  useRefreshOnFocus(navigation, () => {
    void loadSessions();
    void loadSessionsPage();
    if (tab === "measurements") {
      void loadMeasurements();
      void loadMeasurementsPage();
    }
  });

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
              // Se era l'unica sessione della pagina corrente (e non e' la
              // prima), torna a quella precedente invece di lasciare la
              // vista vuota con "Successiva" disabilitato.
              if (sessionsPage?.items?.length === 1 && page > 1) {
                setPage((current) => current - 1);
              } else {
                void loadSessionsPage();
              }
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
              if (measurementsPage?.items?.length === 1 && measurementsPageNumber > 1) {
                setMeasurementsPageNumber((current) => current - 1);
              } else {
                void loadMeasurementsPage();
              }
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

  const weekBySessionId = sessions ? computeWeekNumbers(sessions) : null;
  const sessionItems = sessionsPage?.items ?? [];

  return (
    <View style={[styles.container, safeAreaPadding]}>
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
          data={sessionItems}
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
              {sessions && sessions.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => {
                      setSortOrder((current) => (current === "desc" ? "asc" : "desc"));
                      setPage(1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("history.sortToggle")}
                  >
                    <Text style={styles.sortButtonText}>
                      {sortOrder === "desc"
                        ? `↓ ${t("history.sortDesc")}`
                        : `↑ ${t("history.sortAsc")}`}
                    </Text>
                  </TouchableOpacity>
                  <QuickFilterChips
                    value={quickFilter}
                    onChange={(preset) => {
                      setQuickFilter(preset);
                      setPage(1);
                    }}
                  />
                  {sessionsPage?.items?.length === 0 && (
                    <Text style={styles.infoText}>{t("history.noSessionsInPeriod")}</Text>
                  )}
                </>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const week = weekBySessionId?.get(item.id);
            const previousSession = index > 0 ? (sessionItems[index - 1] ?? null) : null;
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
          ListFooterComponent={
            sessionsPage && (
              <Pagination
                page={sessionsPage.page}
                pageSize={sessionsPage.pageSize}
                total={sessionsPage.total}
                onPageChange={setPage}
              />
            )
          }
          contentContainerStyle={isTablet ? styles.listContentWide : styles.listContent}
        />
      ) : (
        <FlatList
          data={measurementsPage?.items ?? []}
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
                <>
                  <Text style={styles.sectionNote}>{t("history.measurementsNote")}</Text>
                  <QuickFilterChips
                    value={measurementsQuickFilter}
                    onChange={(preset) => {
                      setMeasurementsQuickFilter(preset);
                      setMeasurementsPageNumber(1);
                    }}
                  />
                  {measurementsPage?.items?.length === 0 && (
                    <Text style={styles.infoText}>{t("history.noMeasurementsInPeriod")}</Text>
                  )}
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <MeasurementEntryCard
              entry={item}
              previous={measurements ? findPreviousMeasurement(measurements, item) : null}
              isDeleting={deletingMeasurementId === item.id}
              onRequestDelete={() => requestDeleteMeasurement(item.id)}
            />
          )}
          ListFooterComponent={
            measurementsPage && (
              <Pagination
                page={measurementsPage.page}
                pageSize={measurementsPage.pageSize}
                total={measurementsPage.total}
                onPageChange={setMeasurementsPageNumber}
              />
            )
          }
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
    ...centeredContentStyle,
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
    ...centeredContentStyle,
  },
  // Su tablet la card di sessione mostra una tabella: niente cap di
  // larghezza qui, ogni card si dimensiona sul proprio contenuto (vedi
  // SessionHistoryCard.tsx).
  listContentWide: {
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
    // Ordinamento e filtri rapidi periodo sono due controlli distinti
    // (ordina vs filtra): senza questo restavano attaccati, nessun'altra
    // spaziatura li separa (QuickFilterChips non ha margine proprio sopra).
    marginBottom: spacing.xl,
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

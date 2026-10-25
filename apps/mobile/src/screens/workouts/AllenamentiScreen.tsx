import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import type { AllenamentoSummary, WorkoutSummary } from "@gym-tracker/shared";
import { useAuth } from "../../auth/useAuth";
import {
  activateAllenamento,
  createAllenamento,
  deleteAllenamento,
  listAllenamenti,
  renameAllenamento,
} from "../../api/allenamenti";
import { getWorkout, listWorkouts, updateWorkout } from "../../api/workouts";
import { moveWorkoutInput } from "../../utils/workout-form-utils";
import { ApiRequestError } from "../../api/client";
import { colors, radius, spacing } from "../../theme/theme";
import { centeredContentStyle } from "../../theme/layout";
import { PromptModal } from "../../components/PromptModal";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { WorkoutsStackParamList } from "../../navigation/WorkoutsNavigator";

type Props = NativeStackScreenProps<WorkoutsStackParamList, "Allenamenti">;

interface MoveTarget {
  workout: WorkoutSummary;
  options: AllenamentoSummary[];
}

/**
 * Gestione allenamenti (gruppi di schede): una scheda appartiene a
 * esattamente un allenamento, al massimo uno e' attivo (quello usato dalla
 * Dashboard per il "prossimo esercizio"). Equivalente mobile di
 * apps/web/src/pages/AllenamentiPage.tsx — la lista Schede resta invariata
 * (mostra sempre tutte le schede), questa e' solo il livello di
 * raggruppamento/filtro sopra.
 */
export function AllenamentiScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [allenamenti, setAllenamenti] = useState<AllenamentoSummary[] | null>(null);
  const [workoutsByAllenamento, setWorkoutsByAllenamento] = useState<Map<string, WorkoutSummary[]>>(
    new Map()
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AllenamentoSummary | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      const list = await listAllenamenti(token);
      setAllenamenti(list);
      const workoutLists = await Promise.all(list.map((a) => listWorkouts(token, a.id)));
      setWorkoutsByAllenamento(new Map(list.map((a, i) => [a.id, workoutLists[i] ?? []])));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("common.errorUnexpected"));
    }
  }, [token, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Rifà il fetch al ritorno in primo piano: dopo aver spostato/eliminato
  // una scheda da un'altra schermata (es. Elimina scheda in WorkoutDetail)
  // la lista qui mostrerebbe altrimenti i conteggi di prima. Vedi
  // useRefreshOnFocus.
  useRefreshOnFocus(navigation, refresh);

  async function handleCreateConfirm(name: string): Promise<void> {
    setIsCreating(false);
    if (!token) {
      return;
    }
    setIsBusy(true);
    try {
      await createAllenamento(token, name);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("allenamenti.createError"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRenameConfirm(name: string): Promise<void> {
    const target = renameTarget;
    setRenameTarget(null);
    if (!token || !target) {
      return;
    }
    setIsBusy(true);
    try {
      await renameAllenamento(token, target.id, name);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("allenamenti.renameError"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleActivate(id: string): Promise<void> {
    if (!token) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      await activateAllenamento(token, id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("allenamenti.activateError"));
    } finally {
      setIsBusy(false);
    }
  }

  function requestDelete(allenamento: AllenamentoSummary): void {
    Alert.alert(t("allenamenti.deleteConfirmTitle", { name: allenamento.name }), undefined, [
      { text: t("workouts.create.cancel"), style: "cancel" },
      {
        text: t("allenamenti.delete"),
        style: "destructive",
        onPress: () => {
          if (!token) {
            return;
          }
          setIsBusy(true);
          deleteAllenamento(token, allenamento.id)
            .then(() => refresh())
            .catch((err: unknown) => {
              setError(err instanceof ApiRequestError ? err.message : t("allenamenti.deleteError"));
            })
            .finally(() => setIsBusy(false));
        },
      },
    ]);
  }

  async function handleMoveSelect(targetAllenamentoId: string): Promise<void> {
    const target = moveTarget;
    setMoveTarget(null);
    if (!token || !target) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const detail = await getWorkout(token, target.workout.id);
      await updateWorkout(token, target.workout.id, moveWorkoutInput(detail, targetAllenamentoId));
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("allenamenti.moveError"));
    } finally {
      setIsBusy(false);
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      </View>
    );
  }

  if (allenamenti === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.description}>{t("allenamenti.description")}</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => setIsCreating(true)}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t("allenamenti.new")}
        >
          <Text style={styles.newButtonText}>{t("allenamenti.new")}</Text>
        </TouchableOpacity>
      </View>

      {allenamenti.length === 0 && <Text style={styles.emptyText}>{t("allenamenti.empty")}</Text>}

      {allenamenti.map((allenamento) => {
        const workouts = workoutsByAllenamento.get(allenamento.id) ?? [];
        const altri = allenamenti.filter((a) => a.id !== allenamento.id);
        return (
          <View key={allenamento.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadText}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{allenamento.name}</Text>
                  <Text
                    style={[
                      styles.pill,
                      allenamento.isActive ? styles.pillActive : styles.pillInactive,
                    ]}
                  >
                    {allenamento.isActive ? t("allenamenti.active") : t("allenamenti.inactive")}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  {t("allenamenti.workoutCount", { count: allenamento.workoutCount })}
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {!allenamento.isActive && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleActivate(allenamento.id)}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel={t("allenamenti.activate")}
                >
                  <Text style={styles.actionButtonText}>{t("allenamenti.activate")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setRenameTarget(allenamento)}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={t("allenamenti.rename")}
              >
                <Text style={styles.actionButtonText}>{t("allenamenti.rename")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={() => requestDelete(allenamento)}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={t("allenamenti.delete")}
              >
                <Text style={styles.actionButtonDangerText}>{t("allenamenti.delete")}</Text>
              </TouchableOpacity>
            </View>

            {workouts.length === 0 && (
              <Text style={styles.noWorkoutsText}>{t("allenamenti.noWorkoutsHere")}</Text>
            )}
            {workouts.map((workout) => (
              <View key={workout.id} style={styles.schedaRow}>
                <Text style={styles.schedaRowName}>{workout.name}</Text>
                {altri.length > 0 && (
                  <TouchableOpacity
                    style={styles.moveButton}
                    onPress={() => setMoveTarget({ workout, options: altri })}
                    disabled={isBusy}
                    accessibilityRole="button"
                    accessibilityLabel={t("allenamenti.moveTo")}
                  >
                    <Text style={styles.moveButtonText}>{t("allenamenti.moveTo")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        );
      })}

      <PromptModal
        visible={isCreating}
        message={t("allenamenti.createPromptMessage")}
        label={t("allenamenti.createPromptLabel")}
        initialValue=""
        onConfirm={handleCreateConfirm}
        onCancel={() => setIsCreating(false)}
      />

      <PromptModal
        visible={renameTarget !== null}
        message={t("allenamenti.renamePromptMessage", { name: renameTarget?.name ?? "" })}
        label={t("allenamenti.renamePromptLabel")}
        initialValue={renameTarget?.name ?? ""}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />

      <Modal
        visible={moveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.message}>
              {t("allenamenti.moveWorkoutTitle", { name: moveTarget?.workout.name ?? "" })}
            </Text>
            {moveTarget?.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.moveOption}
                onPress={() => handleMoveSelect(option.id)}
                accessibilityRole="button"
                accessibilityLabel={option.name}
              >
                <Text style={styles.moveOptionText}>{option.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setMoveTarget(null)}
              accessibilityRole="button"
              accessibilityLabel={t("workouts.create.cancel")}
            >
              <Text style={styles.cancelButtonText}>{t("workouts.create.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    gap: spacing.md,
    ...centeredContentStyle,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
  },
  headerRow: {
    gap: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
  },
  newButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  newButtonText: {
    color: colors.accentContrast,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeadText: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  pill: {
    fontSize: 11,
    fontWeight: "700",
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    overflow: "hidden",
  },
  pillActive: {
    color: colors.accentContrast,
    backgroundColor: colors.accent,
  },
  pillInactive: {
    color: colors.textMuted,
    backgroundColor: colors.surface2,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  actionButtonDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  actionButtonDangerText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  noWorkoutsText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  schedaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  schedaRowName: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  moveButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  moveButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
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
    gap: spacing.sm,
  },
  message: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  moveOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  moveOptionText: {
    color: colors.text,
    fontSize: 14,
  },
  cancelButton: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
  },
});

import { useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Exercise } from "@gym-tracker/shared";
import { colors, radius, spacing } from "../../theme/theme";

interface ExerciseComboboxProps {
  value: string;
  selected: Exercise | undefined;
  groupedCatalog: Array<[string, Exercise[]]>;
  onChange: (exerciseId: string) => void;
}

interface Row {
  key: string;
  label: string;
  isGroup: boolean;
  item?: Exercise;
}

function buildRows(groupedCatalog: Array<[string, Exercise[]]>, query: string): Row[] {
  const q = query.trim().toLowerCase();
  const rows: Row[] = [];
  for (const [muscleGroup, items] of groupedCatalog) {
    const matches = q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items;
    if (matches.length === 0) {
      continue;
    }
    rows.push({ key: `group-${muscleGroup}`, label: muscleGroup, isGroup: true });
    for (const item of matches) {
      rows.push({ key: item.id, label: item.name, isGroup: false, item });
    }
  }
  return rows;
}

/** Sostituisce il Picker nativo: un campo di testo che filtra il catalogo
 *  (raggruppato per muscolo) mentre digiti, con la lista a comparsa subito
 *  sotto. Vedi ExerciseCombobox di apps/web per l'equivalente web. */
export function ExerciseCombobox({
  value,
  selected,
  groupedCatalog,
  onChange,
}: ExerciseComboboxProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // L'onPress di una voce arriva dopo l'onBlur del campo (il tap sposta il
  // focus prima che il TouchableOpacity riceva l'evento): un breve ritardo
  // sulla chiusura lascia il tempo a selectItem di annullarla, invece di far
  // sparire la lista prima che il tap venga gestito.
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rows = buildRows(groupedCatalog, isOpen ? query : "");

  function open(): void {
    setQuery("");
    setIsOpen(true);
  }

  function scheduleClose(): void {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 150);
  }

  function selectItem(item: Exercise): void {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    onChange(item.id);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.input}
        value={isOpen ? query : (selected?.name ?? "")}
        onFocus={open}
        onBlur={scheduleClose}
        onChangeText={setQuery}
        placeholder={t("workouts.create.searchExercise")}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t("workouts.create.exercise")}
      />
      {isOpen && (
        <View style={styles.dropdown}>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownList}
            renderItem={({ item: row }) =>
              row.isGroup ? (
                <Text style={styles.groupLabel}>{row.label}</Text>
              ) : (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => row.item && selectItem(row.item)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.optionText, row.item?.id === value && styles.optionTextSelected]}
                  >
                    {row.label}
                  </Text>
                </TouchableOpacity>
              )
            }
            ListEmptyComponent={
              <Text style={styles.empty}>{t("workouts.create.noExerciseFound")}</Text>
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    zIndex: 20,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    maxHeight: 260,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dropdownList: {
    maxHeight: 260,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
  },
  optionTextSelected: {
    color: colors.accent,
    fontWeight: "700",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    padding: spacing.md,
  },
});

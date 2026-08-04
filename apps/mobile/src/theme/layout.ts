import type { ViewStyle } from "react-native";
import { spacing } from "./theme";

/** Larghezza massima per contenuto a colonna singola (form, dialog) su
 *  schermi larghi — oltre questa soglia il contenuto resta leggibile
 *  invece di stirarsi a piena larghezza tablet. Valore arbitrario ma
 *  ragionevole per un form mobile (email/password, note scheda, ecc.),
 *  non legato a nessuna soglia di device-class. */
export const MAX_CONTENT_WIDTH_DP = 640;

/** Stile "cap + centra": applicabile sia a una View semplice sia al
 *  contentContainerStyle di uno ScrollView/FlatList esistente — per
 *  quest'ultimo caso un componente wrapper non è utilizzabile (aggiunge
 *  un livello di View che romperebbe header/footer della lista), da qui
 *  uno style helper invece di un componente per la maggior parte dei
 *  bersagli (vedi CenteredContent.tsx per le 4 schermate auth, le uniche
 *  dove serve comunque una View in più). */
export const centeredContentStyle: ViewStyle = {
  width: "100%",
  maxWidth: MAX_CONTENT_WIDTH_DP,
  alignSelf: "center",
};

/** Pattern "griglia di campi" già usato da MeasurementEntryCard.tsx
 *  (righe 96-104) — estratto qui per riusarlo anche nella tab Misure del
 *  Profilo senza duplicarlo. Il container resta identico per qualunque
 *  numero di colonne (flexDirection row + wrap + gap); solo la larghezza
 *  minima di ogni campo cambia in base a quante colonne si vogliono in
 *  una riga. La sottrazione (-10) lascia margine al gap tra colonne,
 *  stessa proporzione della card originale (40% per 2 colonne, non 50%
 *  esatto). */
export const fieldGridStyle: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.md,
};

export function fieldGridItemStyle(columns: number): ViewStyle {
  return {
    minWidth: `${Math.floor(100 / columns) - 10}%`,
    flexGrow: 1,
  };
}

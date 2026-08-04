import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { centeredContentStyle } from "../theme/layout";

interface CenteredContentProps {
  children: ReactNode;
  style?: ViewStyle;
}

/** Wrapper per le schermate auth (Login/Register/ForgotPassword/
 *  ResetPassword) — le uniche schermate che non sono già dentro una
 *  lista/ScrollView esistente, dove serve comunque una View in più
 *  (altrove si usa lo style helper centeredContentStyle direttamente sul
 *  contentContainerStyle, vedi theme/layout.ts).
 *
 *  Gotcha verificato mentre si progettava questo componente (mockup su
 *  artifact): il centraggio verticale non basta metterlo qui — se una
 *  qualunque View intermedia tra lo schermo e questo componente non ha
 *  `flex: 1` esplicito, quella View collassa all'altezza del proprio
 *  contenuto invece di riempire lo schermo, e questo componente non ha
 *  più spazio extra in cui centrarsi (sembra "ancorato in alto" anche
 *  con justifyContent/alignItems: "center" impostati correttamente qui).
 *  Ogni schermata che usa CenteredContent deve avere `flex: 1` su ogni
 *  View che sta sopra di esso nell'albero, fino allo schermo. */
export function CenteredContent({ children, style }: CenteredContentProps) {
  return (
    <View style={styles.outer}>
      <View style={[centeredContentStyle, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});

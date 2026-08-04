import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../theme/theme";

interface ResponsiveCardColumnsProps {
  /** Numero di colonne correnti, tipicamente da useResponsiveColumns(). */
  columns: number;
  children: ReactNode;
}

/** Bucketing in N colonne (round-robin per indice) per collezioni di card
 *  di altezza eterogenea (Dashboard, Statistiche). `flexWrap` non basta
 *  qui: React Native non fa masonry, ogni riga di un flexWrap si allinea
 *  all'elemento più alto e sotto le card più basse resta un buco vuoto —
 *  visibile soprattutto su tablet landscape a 3 colonne con card di
 *  altezza molto diversa (una card con carosello accanto a una con un
 *  solo valore). Con colonne indipendenti (ognuna un View verticale a sé,
 *  che scorre in altezza per conto proprio) non ci sono buchi.
 *  Distribuzione round-robin per indice, non bilanciata sull'altezza
 *  reale delle card: per un numero contenuto di card eterogenee (le 8
 *  della Dashboard) è comunque nettamente meglio di flexWrap, senza
 *  bisogno di misurare nulla a runtime. */
export function ResponsiveCardColumns({ columns, children }: ResponsiveCardColumnsProps) {
  const items = Children.toArray(children);

  if (columns <= 1) {
    return <View style={styles.singleColumn}>{items}</View>;
  }

  const buckets: ReactNode[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => {
    const bucket = buckets[index % columns];
    if (bucket) {
      bucket.push(item);
    }
  });

  return (
    <View style={styles.row}>
      {buckets.map((bucket, i) => (
        <View key={i} style={styles.column}>
          {bucket}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  column: {
    flex: 1,
    gap: spacing.md,
  },
  singleColumn: {
    gap: spacing.md,
  },
});

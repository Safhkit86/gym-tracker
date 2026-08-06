import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../theme/theme";

interface ResponsiveCardColumnsProps {
  /** Numero di colonne correnti, tipicamente da useResponsiveColumns(). */
  columns: number;
  /** Peso relativo di ogni card, stesso ordine di `children` — tipicamente
   *  una proxy dell'altezza resa (es. numero di esercizi in una card
   *  gruppo muscolare). Se assente, distribuzione round-robin per indice
   *  (comportamento originale, va bene per collezioni di card di altezza
   *  già abbastanza uniforme, es. le 8 card fisse della Dashboard). Se
   *  presente, greedy: ogni card va nella colonna con il totale-peso più
   *  basso finora — per collezioni dinamiche (Statistiche: una card per
   *  gruppo muscolare, il cui numero di esercizi varia parecchio) il
   *  round-robin per indice può lasciare una colonna molto più lunga
   *  delle altre solo perché le card grandi sono capitate vicine nello
   *  stesso resto della divisione. */
  weights?: number[];
  children: ReactNode;
}

function bucketRoundRobin(items: ReactNode[], columns: number): ReactNode[][] {
  const buckets: ReactNode[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => {
    const bucket = buckets[index % columns];
    if (bucket) {
      bucket.push(item);
    }
  });
  return buckets;
}

function bucketByWeight(items: ReactNode[], weights: number[], columns: number): ReactNode[][] {
  const buckets: ReactNode[][] = Array.from({ length: columns }, () => []);
  const totals = new Array<number>(columns).fill(0);
  items.forEach((item, index) => {
    // indexOf su un array di soli numeri piccoli: più chiaro di un
    // reduce con accumulatore {index, value}, e columns resta sempre
    // piccolo (2 o 3) in questo progetto — nessun problema di prestazioni.
    const shortestIndex = totals.indexOf(Math.min(...totals));
    const bucket = buckets[shortestIndex];
    if (bucket) {
      bucket.push(item);
      totals[shortestIndex] = (totals[shortestIndex] ?? 0) + (weights[index] ?? 1);
    }
  });
  return buckets;
}

/** Bucketing in N colonne per collezioni di card di altezza eterogenea
 *  (Dashboard, Statistiche). `flexWrap` non basta qui: React Native non fa
 *  masonry, ogni riga di un flexWrap si allinea all'elemento più alto e
 *  sotto le card più basse resta un buco vuoto — visibile soprattutto su
 *  tablet landscape a 3 colonne con card di altezza molto diversa (una
 *  card con carosello accanto a una con un solo valore). Con colonne
 *  indipendenti (ognuna un View verticale a sé, che scorre in altezza per
 *  conto proprio) non ci sono buchi. Vedi `weights` sopra per la scelta
 *  tra le due strategie di distribuzione. */
export function ResponsiveCardColumns({ columns, weights, children }: ResponsiveCardColumnsProps) {
  const items = Children.toArray(children);

  if (columns <= 1) {
    return <View style={styles.singleColumn}>{items}</View>;
  }

  const buckets =
    weights && weights.length === items.length
      ? bucketByWeight(items, weights, columns)
      : bucketRoundRobin(items, columns);

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

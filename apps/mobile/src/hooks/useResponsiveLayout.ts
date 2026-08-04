import { Dimensions, useWindowDimensions } from "react-native";

/** Soglia device-class (tablet vs telefono), convenzione Android
 *  `sw600dp` — un dispositivo il cui lato corto è >= 600dp è un tablet. */
export const TABLET_MIN_DIMENSION_DP = 600;

/** Soglia di larghezza corrente sopra la quale una griglia passa a 2
 *  colonne — stessa soglia della device-class: sopra è già "larghezza da
 *  tablet". */
export const WIDE_LAYOUT_MIN_WIDTH_DP = 600;

/** Soglia di larghezza corrente sopra la quale una griglia passa a 3
 *  colonne — stessa soglia usata dalla webapp (`NARROW_TABLE_LAYOUT_QUERY`
 *  in apps/web/src/hooks/useIsNarrowViewport.ts, vedi CLAUDE.md sullo
 *  standard di responsività unico per il progetto), non un valore nuovo
 *  inventato per il mobile. */
export const EXTRA_WIDE_LAYOUT_MIN_WIDTH_DP = 1024;

/** Device class (tablet vs telefono): stabile durante la rotazione perché
 *  usa Dimensions.get("screen") (dimensione fisica dello schermo) invece
 *  di useWindowDimensions() (dimensione della *finestra* — con
 *  ios.supportsTablet true un iPad in Split View/Slide Over avrebbe una
 *  finestra stretta e verrebbe scambiato per un telefono). Math.min sui
 *  due lati perché lo schermo è lo stesso sia in portrait sia in
 *  landscape, solo width/height si scambiano. */
export function useIsTabletDevice(): boolean {
  const { width, height } = Dimensions.get("screen");
  return Math.min(width, height) >= TABLET_MIN_DIMENSION_DP;
}

/** Quante colonne mostrare *ora* per una griglia, in base alla larghezza
 *  disponibile corrente (reattiva alla rotazione, a differenza della
 *  device class sopra). `maxColumns` è il tetto richiesto dal chiamante:
 *  alcune griglie (es. Dashboard) hanno senso fino a 3 colonne, altre
 *  (es. tab Misure del profilo) restano a 2 anche in landscape perché il
 *  contenuto delle card non lo giustifica. */
export function useResponsiveColumns(maxColumns: 2 | 3): number {
  const { width } = useWindowDimensions();
  if (maxColumns === 3 && width >= EXTRA_WIDE_LAYOUT_MIN_WIDTH_DP) {
    return 3;
  }
  if (width >= WIDE_LAYOUT_MIN_WIDTH_DP) {
    return 2;
  }
  return 1;
}

/** true quando la larghezza corrente è da tablet in landscape — usata per
 *  decidere la posizione della tab bar (sidebar a sinistra) e altre
 *  scelte di layout legate specificamente al landscape, non solo alla
 *  larghezza. */
export function useIsTabletLandscape(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height && width >= EXTRA_WIDE_LAYOUT_MIN_WIDTH_DP;
}

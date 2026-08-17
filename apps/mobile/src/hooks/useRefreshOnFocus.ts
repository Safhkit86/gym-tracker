import { useEffect, useRef } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

/**
 * Richiama `onFocus` ogni volta che la schermata torna in primo piano
 * (mount incluso), non solo alla prima volta: il tab/sidebar di
 * navigazione di questa app mantiene le schermate montate quando si
 * cambia tab (a differenza della webapp, dove ogni route si smonta/
 * rimonta ad ogni navigazione) — senza questo, i dati mostrati restano
 * quelli dell'ultima visita anche dopo un'azione altrove che li rende
 * obsoleti (accettare/leggere un suggerimento, loggare una sessione,
 * salvare una misura, ecc. — riportato dall'utente su più schermate).
 *
 * Prende `navigation` come parametro invece di usare
 * useFocusEffect/useNavigation() di React Navigation: quest'ultimo
 * richiederebbe un vero NavigationContainer nei test di questo
 * progetto, che invece mockano `navigation` come prop (vedi
 * NotificationsScreen.tsx, il primo posto dove questo pattern è stato
 * introdotto, e i relativi test).
 *
 * `onFocus` è letto da un ref sempre aggiornato (stesso trucco di
 * soundEnabledRef/hasActiveTimerRef in useRestTimers.ts): l'effetto si
 * risottoscrive solo se cambia `navigation` (stabile tra i render), non
 * ad ogni render per via di una nuova identità di `onFocus`.
 */
export function useRefreshOnFocus(
  navigation: NavigationProp<ParamListBase>,
  onFocus: () => void
): void {
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    return navigation.addListener("focus", () => onFocusRef.current());
  }, [navigation]);
}

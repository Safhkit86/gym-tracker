import { useEffect, useRef } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

/**
 * Intervallo minimo tra due refresh consecutivi innescati dal focus.
 * Senza, cambiare tab rapidamente (es. Dashboard -> Statistiche ->
 * Dashboard in pochi secondi, un pattern d'uso normale, non solo di
 * test) rifà da capo tutte le richieste della schermata anche se i dati
 * non possono essere cambiati nel frattempo — la Dashboard da sola fa
 * 10-20 richieste per caricamento (dettaglio di ogni scheda, storico di
 * ogni esercizio, ecc.), e ripeterle ad ogni focus ravvicinato ha
 * contribuito concretamente a far scattare il rate limit del gateway
 * durante un uso interattivo reale (riportato dall'utente). Non riduce
 * la correttezza del fix originale: un'azione che invalida i dati
 * altrove (accettare una notifica, salvare una misura, loggare una
 * sessione) e poi tornare qui *dopo* la soglia rifà comunque il fetch;
 * se capitasse entro la soglia, i dati sarebbero comunque freschi di
 * pochi secondi.
 */
const MIN_REFRESH_INTERVAL_MS = 10_000;

/**
 * Richiama `onFocus` ogni volta che la schermata torna in primo piano
 * (mount incluso), non solo alla prima volta: il tab/sidebar di
 * navigazione di questa app mantiene le schermate montate quando si
 * cambia tab (a differenza della webapp, dove ogni route si smonta/
 * rimonta ad ogni navigazione) — senza questo, i dati mostrati restano
 * quelli dell'ultima visita anche dopo un'azione altrove che li rende
 * obsoleti (accettare/leggere un suggerimento, loggare una sessione,
 * salvare una misura, ecc. — riportato dall'utente su più schermate).
 * Un focus troppo ravvicinato all'ultimo refresh (vedi
 * MIN_REFRESH_INTERVAL_MS sopra) viene ignorato.
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

  // Inizializzato al momento del mount, non a 0: il primo evento "focus"
  // utile arriva solo dopo che la schermata è già montata (addListener
  // non spara per lo stato già a fuoco al mount, vedi sopra e il
  // useEffect di mount separato in ogni schermata che la usa), quindi
  // questo timestamp approssima correttamente "quando i dati sono stati
  // caricati l'ultima volta" anche per quel primo evento di focus.
  const lastRunAtRef = useRef(Date.now());

  useEffect(() => {
    return navigation.addListener("focus", () => {
      const now = Date.now();
      if (now - lastRunAtRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRunAtRef.current = now;
      onFocusRef.current();
    });
  }, [navigation]);
}

# Supporto tablet — avanzamento

Checklist di lavoro per l'iniziativa "supporto tablet" (dopo la Fase 8 e
la gestione password mobile). Piano completo, decisioni e motivazioni
nella conversazione che ha originato questo lavoro — qui solo lo stato.
File temporaneo: da rimuovere (o ridurre a una riga di changelog) una
volta che la PR è mergiata, non è pensato per restare a lungo termine.

- [ ] Infrastruttura di test: `jest.setup.ts` fissa le dimensioni
      schermo a misura telefono, mock di `expo-screen-orientation`,
      helper dimensioni in `test/helpers.tsx`
- [ ] Hook responsive condivisi: `useResponsiveLayout.ts`
      (`useIsTabletDevice`, `useResponsiveColumns`) + test
- [ ] `theme/layout.ts`: costanti/stili "cap + centra", stile
      grid/field estratto da `MeasurementEntryCard`
- [ ] `ResponsiveCardColumns` (bucketing colonne, card eterogenee)
- [ ] `CenteredContent` (wrapper per le 4 schermate auth)
- [ ] Schermate auth (Login/Register/ForgotPassword/ResetPassword):
      cap+centra, `flex:1` in ogni View intermedia, scroll con
      tastiera in landscape
- [ ] `WorkoutForm`, `PromptModal`, `RestTimerTray`, tab
      Account/Preferenze profilo, tab-switcher row: cap+centra
- [ ] `WorkoutDetailScreen`, `HistoryScreen`, `NotificationsScreen`:
      colonna singola centrata (non griglia — l'ordine conta)
- [ ] `DashboardScreen`, `StatisticsScreen`: griglia bucket-colonne
- [ ] `WorkoutsListScreen`: griglia
- [ ] Tab "Misure" del Profilo: griglia (stile riusato da
      `MeasurementEntryCard`)
- [ ] Fix `StreakCalendar` (7 colonne reali, bug preesistente anche su
      telefono)
- [ ] Fix `MiniLineChart` (larghezza reale via `onLayout`)
- [ ] Fix `HorizontalPeekCarousel` (cap `itemWidth` assoluto)
- [ ] Fix `VerticalPeekList` (`itemHeight` ricalcolato alla rotazione)
- [ ] Safe area insets sui container di primo livello
- [ ] `LogSessionScreen` sotto-step A — verticale cap+centra
- [ ] `LogSessionScreen` sotto-step B — scheletro tabella landscape,
      stesso stato sollevato del form esistente
- [ ] `LogSessionScreen` sotto-step C — parità visiva con la webapp
      (etichette target, spaziatore Kg, timer recupero, riga
      separatrice)
- [ ] `LogSessionScreen` sotto-step D — casi limite (set variabili,
      scroll orizzontale, tap target)
- [ ] `MainTabNavigator`: sidebar a sinistra su tablet in landscape
- [ ] `expo-screen-orientation` + `app.json` (`orientation: "default"`,
      `ios.supportsTablet`/`requireFullScreen`) + `App.tsx` — **ultimo**
- [ ] AVD `Pixel_Tablet` creato (skin 2560×1600 @ 320dpi)
- [ ] Build/lint/test puliti lungo tutta la serie di commit
- [ ] Verifica end-to-end sull'AVD: giro completo portrait, rotazione,
      giro completo landscape (incluso sotto-step E di LogSession —
      integrità dei dati alla rotazione)
- [ ] README.md — voce roadmap per il supporto tablet
- [ ] PR aperta, CI verde, mergiata

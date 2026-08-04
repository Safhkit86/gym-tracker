# Supporto tablet — avanzamento

Checklist di lavoro per l'iniziativa "supporto tablet" (dopo la Fase 8 e
la gestione password mobile). Piano completo, decisioni e motivazioni
nella conversazione che ha originato questo lavoro — qui solo lo stato.
File temporaneo: da rimuovere (o ridurre a una riga di changelog) una
volta che la PR è mergiata, non è pensato per restare a lungo termine.

- [x] Infrastruttura di test: `jest.setup.ts` fissa le dimensioni
      schermo a misura telefono, mock di `expo-screen-orientation`,
      helper dimensioni in `test/helpers.tsx`
- [x] Hook responsive condivisi: `useResponsiveLayout.ts`
      (`useIsTabletDevice`, `useResponsiveColumns`) + test
- [x] `theme/layout.ts`: costanti/stili "cap + centra", stile
      grid/field estratto da `MeasurementEntryCard`
- [x] `ResponsiveCardColumns` (bucketing colonne, card eterogenee)
- [x] `CenteredContent` (wrapper per le 4 schermate auth)
- [x] Schermate auth (Login/Register/ForgotPassword/ResetPassword):
      cap+centra, `flex:1` in ogni View intermedia, scroll con
      tastiera in landscape
- [x] `WorkoutForm`, `PromptModal`, `RestTimerTray`, tab
      Account/Preferenze profilo: cap+centra
- [x] `WorkoutDetailScreen`, `HistoryScreen`, `NotificationsScreen`:
      colonna singola centrata (non griglia — l'ordine conta)
- [x] `DashboardScreen`, `StatisticsScreen`: griglia bucket-colonne
- [x] `WorkoutsListScreen`: griglia
- [x] Tab "Misure" del Profilo: griglia (stile riusato da
      `MeasurementEntryCard`)
- [x] Fix `StreakCalendar` (7 colonne reali, bug preesistente anche su
      telefono)
- [x] Fix `MiniLineChart` (larghezza reale via `onLayout`)
- [x] Fix `HorizontalPeekCarousel` (cap `itemWidth` assoluto)
- [x] Fix `VerticalPeekList` (`itemHeight` ricalcolato alla rotazione)
- [x] Safe area insets sui container di primo livello — durante la
      verifica su AVD, trovato e corretto un bug reale (non solo il caso
      "notch non verificabile" previsto dal piano): il Pixel Tablet ha
      una taskbar di sistema persistente in basso, riportata come inset
      `navigationBars` reale (~94dp), e `RestTimerTray` aveva un
      `bottom` fisso che ci finiva mezzo nascosto sotto — ora usa
      `useSafeAreaInsets().bottom`
- [x] `LogSessionScreen` sotto-step A — verticale cap+centra
- [x] `LogSessionScreen` sotto-step B — scheletro tabella landscape,
      stesso stato sollevato del form esistente
- [x] `LogSessionScreen` sotto-step C — parità visiva con la webapp
      (etichette target, spaziatore Kg, timer recupero, riga
      separatrice)
- [x] `LogSessionScreen` sotto-step D — casi limite (set variabili,
      scroll orizzontale). Tap target verificato sull'AVD: le colonne a
      84dp (~168px fisici a 320dpi) sono comode al tocco, nessuna
      correzione necessaria
- [x] `MainTabNavigator`: sidebar a sinistra su tablet in landscape
- [x] `expo-screen-orientation` + `app.json` (`orientation: "default"`,
      `ios.supportsTablet`/`requireFullScreen`) + `App.tsx` — **ultimo**
- [x] AVD `Pixel_Tablet` creato (skin 2560×1600 @ 320dpi, partizione dati
      ridotta a 6G per spazio disco insufficiente sulla macchina)
- [x] Build/lint/test puliti lungo tutta la serie di commit (61 test,
      17 suite, lint pulito)
- [x] Verifica end-to-end sull'AVD: giro completo portrait, rotazione,
      giro completo landscape (incluso sotto-step E di LogSession —
      integrità dei dati alla rotazione, verificata modificando un
      valore reps in tabella e ruotando avanti e indietro). Spot-check
      su Dashboard, Statistics, WorkoutsList, WorkoutDetail, History,
      Notifications, Profile (Account/Misure/Preferenze), sidebar con
      badge, RestTimerTray durante un timer attivo — trovato e corretto
      un bug reale di safe-area (vedi sopra)
- [x] README.md — voce roadmap per il supporto tablet
- [ ] PR aperta, CI verde, mergiata

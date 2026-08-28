# gym-tracker — convenzioni per Claude Code

Monorepo a microservizi (Node.js/TypeScript, npm workspaces) per un'app di
tracking allenamenti in palestra. Vedi README.md per l'architettura completa.

## Struttura

- `packages/shared` — tipi e contratti condivisi tra i servizi
- `services/account-service` — utenti, autenticazione, JWT (implementato)
- `services/workout-service` — schede/esercizi (implementato)
- `services/api-gateway` — unico punto di ingresso per i client, reverse-proxy
  verso i servizi (implementato in forma minima)
- `services/progress-service` — storico + regole di progressione (Fase 3, TODO)
- `services/notify-service` — notifiche (Fase 4, TODO)
- `apps/web` — webapp React/Vite/TypeScript, parla solo con `api-gateway`
- `apps/mobile` — app React Native/Expo (Android + iOS, Fase 8, in corso),
  parla solo con `api-gateway` come `apps/web`

## Convenzioni di codice

- TypeScript strict mode ovunque (vedi `tsconfig.base.json`), niente `any`
  non giustificato.
- Ogni servizio è un'app Express indipendente con un file `app.ts` (la
  factory `createApp()`, testabile) separato da `index.ts` (l'entry point
  che avvia il server). Segui questo pattern per i nuovi servizi.
- Ogni servizio espone `GET /health` con la stessa forma di risposta
  (`buildHealthStatus` da `@gym-tracker/shared`).
- Test con Vitest + Supertest, nella cartella `test/` di ogni servizio.
  Un endpoint nuovo senza test non è considerato completo.
- Niente `console.*`: ogni servizio usa il logger strutturato condiviso
  (`createLogger`/`createHttpLogger` da `@gym-tracker/shared`, vedi
  `packages/shared/src/logger.ts` e `http-logger.ts`) — l'eslint rule
  `no-console` è a "error". Ogni richiesta HTTP viene loggata automaticamente
  (metodo, path, status, durata, id di correlazione); l'header
  `X-Request-Id` (generato da `api-gateway` se il client non lo manda,
  riusato invariato se presente, propagato invariato ai servizi a valle)
  permette di correlare le righe di log della stessa richiesta tra servizi
  diversi. Fuori dal ciclo richiesta/risposta (migrazioni, retry di
  connessione RabbitMQ) usa comunque `createLogger("<service-name>")`, mai
  `console.*` diretto.
- Il `Dockerfile` di ogni servizio usa come build context la root del
  monorepo (necessario perché npm workspaces risolva `@gym-tracker/shared`).
  Ogni stage che esegue comandi npm con `--workspace` deve copiare il
  `package.json` (e `package-lock.json*`) di root, non solo quelli dei
  singoli workspace: senza il manifest di root, `/app` non è riconosciuto
  come workspace root e `npm run build --workspace=...` fallisce con
  `ENOENT: package.json`. Usa il Dockerfile di `account-service` come modello.
- `apps/web` è containerizzata sia in dev che in prod, con stage Docker
  diversi nello stesso `apps/web/Dockerfile`: `dev` (Vite dev server con hot
  reload, usato da `docker-compose.yml`) e `runtime` (nginx su build statica,
  usato da `docker-compose.prod.yml`). Lo stage `dev` non copia il codice
  sorgente nell'immagine: `docker-compose.yml` monta l'intero monorepo come
  bind mount su `/app` (necessario per npm workspaces), con due volumi
  nominati dedicati (`web-node-modules`, `web-app-node-modules`) sui path di
  `node_modules` per evitare che il bind mount nasconda le dipendenze già
  installate nell'immagine — un volume nominato, al primo avvio, si
  inizializza copiando il contenuto già presente nell'immagine in quel path,
  quindi l'ordine conta (installazione delle dipendenze nel Dockerfile prima
  che il volume venga dichiarato in compose). Se cambia `apps/web/package.json`
  vanno ricreati anche questi due volumi, non solo l'immagine. Pattern da
  replicare per un futuro servizio frontend con hot reload containerizzato,
  non necessario per i servizi backend Express (nessun bundler/dev server
  coinvolto, `npm run dev` con `tsx watch` funziona già bene sull'host).
- Ogni `src/config.ts` carica il `.env` di root con `dotenv` (vedi
  `services/account-service/src/config.ts`) prima di validare lo schema zod:
  serve solo quando il servizio gira sull'host (`npm run dev`/`db:migrate`
  fuori da Docker), dove le variabili non arrivano già impostate come fa
  docker-compose. Non sovrascrive variabili già in `process.env` e non fa
  nulla se il file non esiste (dentro l'immagine Docker `.env` non c'è).
  Aggiungi questo stesso blocco al `config.ts` di ogni nuovo servizio.
- Tutti i servizi condividono lo stesso database Postgres (stesso
  `DATABASE_URL`, tabelle diverse per servizio): nel `Migrator` di Kysely
  (`src/db/migrate.ts`) imposta sempre `migrationTableName` e
  `migrationLockTableName` con un suffisso per servizio (es.
  `kysely_migration_account`, `kysely_migration_workout`), altrimenti la tabella
  di tracking migrazioni di default (`kysely_migration`) collide tra servizi
  e la migrazione fallisce con "corrupted migrations".
- Tutti i workspace (servizi backend + `apps/web`) usano la stessa major di
  `vitest` (v4, una sola copia hoisted in root — fino all'aggiornamento per
  una CVE di esbuild/vitest il backend era fermo alla v2, con due copie npm
  separate). `apps/web/src/test/setup.ts`/`jest-dom.d.ts` importano ed
  estendono `expect` a mano invece di affidarsi all'entry point `/vitest` di
  `@testing-library/jest-dom`: non e' piu' strettamente necessario ora che
  c'e' una sola copia di `vitest`, ma il workaround resta comunque corretto
  e non e' stato rimosso (nessun bisogno di toccare l'infrastruttura di test
  funzionante insieme a un fix di sicurezza).
- `api-gateway` ha `cors()` globale perché la webapp (altra origine: Vite dev
  o un dominio statico) lo chiama via fetch da browser: senza CORS le
  richieste vengono bloccate lato client. Nessun altro servizio ne ha bisogno,
  la webapp non li chiama mai direttamente.
- `apps/mobile` (React Native/Expo) usa **Jest**, non Vitest: l'ecosistema
  React Native richiede il preset `jest-expo`, che Vitest non supporta.
  Test con `@testing-library/react-native` — usa la **v13** (`^13.3.3`),
  non la v14: la v14 ha spostato il renderer da `react-test-renderer` al
  nuovo pacchetto `test-renderer`, e al momento della Fase 8 `jest-expo`
  non e' ancora compatibile con questo cambio (`render()` in test ritorna
  silenziosamente un oggetto vuoto, nessun errore esplicito — sintomo da
  ricordare se in futuro un aggiornamento di `jest-expo` permette di
  tornare alla v14). `react`/`react-dom` di `apps/web` e `react` di
  `apps/mobile` vanno sempre tenuti sullo stesso range/versione hoisted:
  npm non forza da solo `react`/`react-dom` alla stessa versione (sono due
  pacchetti distinti dal suo punto di vista), ma React stesso si rifiuta di
  partire se non combaciano esattamente — se cambi la versione di uno,
  allinea anche l'altro nello stesso commit. Il runner CI (Linux) e' piu'
  lento della macchina di sviluppo sul cold-start di ogni test suite
  jest-expo (init i18next, prima renderizzazione di `AuthProvider`, ecc.):
  con il timeout di default di Jest (5000ms) il primo test di una suite
  puo' scadere in CI pur passando in locale, da qui `testTimeout: 15000`
  nel blocco `jest` di `apps/mobile/package.json`. **Niente
  `react-native-reanimated` (ne' direttamente ne' via una libreria che lo
  richiede, es. `react-native-draggable-flatlist`) finche' si testa via
  Expo Go**: reanimated 4.x delega l'inizializzazione al modulo nativo
  separato `react-native-worklets`, la cui versione bundle dentro
  l'eseguibile di Expo Go non e' detto combaci con quella richiesta dal
  pacchetto JS — su questo progetto ha causato un crash nativo (SIGSEGV
  dentro `libworklets.so`, thread `mqt_v_js`) al primo utilizzo, non un
  errore JS gestibile. Per interazioni che richiederebbero normalmente
  reanimated/gesture-handler (es. riordino di una lista), preferire
  un'alternativa senza gesture nativi (es. pulsanti ↑/↓) finche' non si
  passa a una dev build custom (EAS Build) invece di Expo Go.
- Un restyling grafico di `apps/web` copre **tutte** le pagine esistenti, non
  solo quelle toccate dalla feature che lo ha motivato: prima di chiudere una
  PR di restyling, passa in rassegna ogni file in `src/pages/` e applica le
  stesse classi/pattern (es. `.card`) usate nelle altre pagine, così l'app non
  finisce con un mix di pagine vecchie e nuove.
- La gestione della larghezza di pagina e della responsività è uno standard
  unico per tutta la webapp, non una scelta per-pagina: ogni pagina con una
  tabella a colonne di larghezza fissa (es. Storico, Registra sessione) usa
  lo stesso breakpoint (`NARROW_TABLE_LAYOUT_QUERY`, 1024px) e lo stesso hook
  condiviso `useIsNarrowViewport` (`apps/web/src/hooks/useIsNarrowViewport.ts`)
  per passare a un layout impilato senza scroll orizzontale sotto la soglia,
  e la stessa classe `main-wide-table` (invece del generico `main-wide`,
  troppo stretto per queste tabelle) sopra la soglia. Quando aggiungi una
  nuova pagina con una tabella simile, riusa questo stesso hook/classe
  invece di reinventare la soglia o il meccanismo.

## Commit e PR

- Commit in italiano o inglese, purché chiari e nel formato
  `tipo: descrizione breve` (es. `feat: aggiungi endpoint login`,
  `fix: correggi validazione peso esercizio`).
- Ogni PR deve passare la pipeline CI (`.github/workflows/ci.yml`): lint,
  test, build, build dell'immagine Docker. Non proporre di saltare o
  disabilitare un check per far passare una PR: se un check fallisce, il
  codice va corretto, non il check.
- Le PR di dimensioni contenute (un servizio o una feature alla volta) sono
  preferibili a PR enormi multi-servizio.
- La sezione "Roadmap del progetto" del `README.md` usa ✅ (fatto) / ⬜ (da
  fare), non le checkbox `- [x]` di markdown. Dalla Fase 1 in poi ogni fase è
  divisa in due sotto-punti indentati, **Backend** e **UI**, spuntati
  indipendentemente. Quando completi un pezzo, aggiorna solo il suo ✅/⬜;
  metti ✅ anche sulla riga della fase (il titolo) solo quando **entrambi**
  i sotto-punti sono ✅ — altrimenti lascia il titolo della fase senza emoji.
  Fai rientrare questo aggiornamento nella stessa PR che completa il pezzo.
- Non lanciare mai più `docker compose build` (o `docker build`) in parallelo
  sulla stessa macchina di sviluppo: Docker Desktop su Windows può bloccarsi
  in contesa sullo stesso builder `buildx`, senza produrre alcun output, finché
  non si riavvia Docker Desktop. Se serve costruire più immagini, farlo in
  sequenza, una alla volta.
- Esiste un secondo stack Docker Compose di produzione, isolato da quello
  di sviluppo (vedi README.md, "Produzione (locale)"): va **sempre**
  avviato con `docker compose -f docker-compose.prod.yml --env-file
.env.production ...` esplicito, mai con un semplice `docker compose up`
  (che userebbe `docker-compose.yml`/`.env` di dev). Se aggiungi un nuovo
  servizio o una nuova variabile d'ambiente allo stack di dev, valuta se
  serve rispecchiarla anche in `docker-compose.prod.yml`/
  `.env.production.example`.

## Comandi utili

```bash
npm install                        # installa tutte le dipendenze (root)
npm run lint                       # lint su tutti i workspace
npm run test                       # test su tutti i workspace
npm run build                      # build su tutti i workspace
docker compose up -d               # avvia infrastruttura + servizi
docker compose up -d postgres redis rabbitmq   # solo infrastruttura
npm run start --workspace=@gym-tracker/mobile  # dev server Expo (scansiona il QR con l'app Expo Go)
```

## Dove salvare quello che impari

Ogni volta che inizi a lavorare su questo progetto, leggi questo file
(`CLAUDE.md`), il `README.md` e la memoria automatica prima di agire: sono
la fonte di contesto aggiornato su convenzioni, stato del progetto e
preferenze dell'utente, e vanno riletti a ogni sessione perché possono
essere cambiati dall'ultima volta.

Quando durante il lavoro emerge qualcosa che vale la pena ricordare per il
futuro, salvalo nel posto giusto invece di lasciarlo solo nella
conversazione corrente:

- **Questo file (`CLAUDE.md`)**: convenzioni di codice, pattern
  architetturali, regole di processo (commit/PR/CI) che valgono per
  chiunque lavori su questo repo, a prescindere da chi lo usa o quando —
  es. una nuova gotcha scoperta su un servizio, un pattern da seguire per i
  nuovi servizi, una regola su cosa non fare.
- **`README.md`**: stato del progetto che riguarda chi legge il repo
  (roadmap delle fasi, architettura, istruzioni di setup) — contenuto
  pubblico del progetto, non istruzioni per l'assistente.
- **Memoria automatica** (fuori dal repo, persistente tra conversazioni):
  preferenze dell'utente su come collaborare, feedback su approcci
  corretti o sbagliati, contesto di progetto con una scadenza o legato a un
  momento preciso (es. "il deploy è previsto per la settimana prossima"),
  riferimenti a sistemi esterni (dashboard, tracker). Non duplicare lì
  quello che si può già dedurre leggendo il codice o la git history.

## Come collaborare (regola di processo)

- Non fare mai più di quanto richiesto e non inventare soluzioni non
  esplicitamente chieste, specialmente su dettagli di UI/UX (posizione di
  un elemento, testo di un'etichetta, struttura di una tabella). Se emerge
  un dubbio interpretativo, o si sta per aggiungere/cambiare qualcosa non
  chiesto esplicitamente, fermarsi e chiedere invece di procedere per
  ipotesi. Quando ci sono più alternative visive plausibili, preferire un
  artifact (mockup/HTML) che l'utente possa guardare e scegliere, invece di
  descriverle solo a parole o implementarne una a caso.
- Dopo ogni modifica alla UI di `apps/web`, verificarla visivamente (screenshot
  Playwright, non solo lint/test/build) prima di dichiararla completa — e
  controllare più di una dimensione di schermo (es. viewport stretto tipo
  mobile oltre a quello desktop), non solo quella comoda in cui è stata
  sviluppata: un elemento può risultare tagliato/mal posizionato solo sotto
  una certa larghezza.
- Nessun MCP Playwright è configurato in questa macchina: per gli screenshot
  di verifica usa il pacchetto `playwright` via Node/Bash. Non è una
  dipendenza del repo — vive gia' installato (browser Chromium incluso)
  nella cartella scratchpad della sessione (`node_modules/playwright`,
  vedi `verify-app.js`/`verify-measurements-ui.js` li' per un esempio):
  scrivi li' un piccolo script che lancia `chromium`, imposta
  `localStorage.setItem("gym-tracker.token", token)` (token di un vero
  login, non un JWT auto-firmato — vedi memoria "test-account") per saltare
  il login via UI, e salva gli screenshot in una sottocartella dello
  scratchpad. Se la cartella scratchpad di una nuova sessione non ha ancora
  `playwright` installato, installalo li' (`npm install playwright` dentro
  quella cartella, non nel repo) prima di scrivere lo script.
- Da quando lo stack di produzione (`docker-compose.prod.yml`,
  `.env.production`) contiene dati reali dell'utente, Claude non deve
  accedere o operare direttamente su di esso (comandi `docker compose -f
docker-compose.prod.yml ...`, query/modifiche al DB di prod, rebuild o
  riavvio dei suoi container) a meno di un'esplicita autorizzazione
  dell'utente caso per caso — non vale come autorizzazione permanente
  un'autorizzazione data in passato per un intervento specifico.

## Cosa NON fare

- Non far comunicare i client (web/Android) direttamente con un servizio:
  passano sempre dall'API Gateway (`services/api-gateway`, implementato in
  forma minima come reverse-proxy; l'hardening con auth centralizzata e rate
  limiting è previsto in Fase 5). Quando aggiungi una rotta a un nuovo
  servizio, aggiungi anche il relativo `app.use(prefix, proxyTo(...))` nel
  gateway.
- Non duplicare tipi/contratti tra servizi: se un tipo serve a più di un
  servizio, va in `packages/shared`.

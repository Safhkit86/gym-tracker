# gym-tracker

App di tracking allenamenti in palestra, costruita come progetto didattico
hands-on: monorepo a microservizi (Node.js/TypeScript), Docker, CI/CD con
validazione automatica delle PR — pensato per essere consumato sia da una
web app che, in futuro, da un'app mobile (Android + iOS), tramite un API
Gateway condiviso.

## Architettura

```
Web app (apps/web) / App mobile React Native (apps/mobile, futuro)
            │
       API Gateway            (minimo: reverse-proxy verso i servizi)
            │
   ┌────────┼────────┬──────────┬─────────┐
   │        │        │          │         │
 Auth   Workout   History   Progress   Notify
   │        │        │          │         │
   └────────┴────────┴──────────┴─────────┘
                │
   PostgreSQL · Redis · RabbitMQ · Mailpit
```

- **api-gateway** — unico punto di ingresso per i client: inoltra le richieste
  ai servizi (`/auth`, `/me` → account-service; `/exercises`, `/workouts` →
  workout-service; `/sessions`, `/stats`, `/measurements` → history-service;
  `/sessions/:id/status`, `/progression` → progress-service;
  `/notifications` → notify-service). Verifica centralmente il Bearer JWT
  (401 prima ancora di raggiungere un servizio a valle, tranne su
  `/auth/register`, `/auth/login`, `/auth/forgot-password` e
  `/auth/reset-password`, pubblici) e applica un rate limit per IP
  (più stringente su `/auth` e su `/me/password`) — in aggiunta, non in
  sostituzione, alla verifica che ogni servizio fa comunque per conto proprio.
- **account-service** — utenti, JWT, reset password via email, cambio password
  con codice email come secondo fattore (Fase 1), preferenze utente. Le email
  (reset password, conferma cambio password) sono catturate in locale da
  **Mailpit** (nessun vero SMTP in sviluppo): UI su http://localhost:8025.
  Tiene in locale solo l'altezza; peso/petto/braccia/vita/gamba sono
  storicizzati in history-service — `PUT /me/measurements` pubblica
  `measurement-save-requested` con publish confermato (nessuna copia locale,
  un fallimento di publish fa fallire la richiesta), `GET /me/measurements`
  legge quei 5 campi da una cache Redis alimentata consumando
  `measurement-recorded`.
- **workout-service** — schede, esercizi, set/reps/peso/recupero (Fase 2)
- **history-service** — storico delle sessioni eseguite, statistiche
  aggregate (Dashboard) e storico misure datato (`measurement_entries`,
  Storico > Misure). Pubblica `session-logged`/`session-deleted` su
  RabbitMQ: progress-service li consuma per valutare il motore di regole in
  modo asincrono, invece di farlo nella stessa richiesta HTTP. Consuma
  `measurement-save-requested` da account-service (upsert per data) e
  ripubblica `measurement-recorded` per la cache di lettura veloce.
- **progress-service** — motore di regole di progressione (Fase 3): decide
  solo _quando_ suggerire un aumento di carico/ripetizioni, non possiede più
  lo storico delle sessioni (spostato in history-service).
- **notify-service** — notifiche quando una regola di progressione scatta
  (Fase 4)

- **web** (`apps/web`) — React + Vite + TypeScript, CSS semplice, fetch
  nativo. Parla solo con `api-gateway`, mai con i singoli servizi.

Ogni servizio backend logga in JSON strutturato (`pino`, vedi
`packages/shared/src/logger.ts`) invece di `console.*`; ogni richiesta HTTP
porta un id di correlazione (`X-Request-Id`, generato da `api-gateway` se
assente e propagato invariato a valle) che permette di seguire la stessa
richiesta nei log di più servizi (Fase 6).

Dalla Fase 1 in poi, ogni fase backend include anche la sua parte di
interfaccia web (dove serve), invece di costruire tutta la webapp in blocco
alla fine. Fase 1 (login/registrazione) e Fase 2 (schede) sono già coperte;
vedi la roadmap qui sotto per lo stato aggiornato.

## Requisiti

- Node.js ≥ 20
- Docker + Docker Compose

## Setup locale

I servizi caricano `.env` automaticamente (anche quando lanciati sull'host,
fuori da Docker): il primo passo qui sotto non è solo un promemoria, è
necessario perché `db:migrate`/`dev` trovino `DATABASE_URL` e `JWT_SECRET`.

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis rabbitmq   # solo infrastruttura
npm run build --workspace=@gym-tracker/shared
npm run db:migrate --workspace=@gym-tracker/account-service      # crea le tabelle
npm run db:migrate --workspace=@gym-tracker/workout-service   # crea le tabelle + seed catalogo
npm run db:migrate --workspace=@gym-tracker/progress-service  # crea anche workout_sessions/session_sets
npm run db:migrate --workspace=@gym-tracker/history-service   # va DOPO progress-service (riusa workout_sessions/session_sets); crea anche measurement_entries
npm run db:migrate --workspace=@gym-tracker/notify-service    # crea le tabelle
cd services/account-service && npm run dev         # avvia account-service in watch mode
# in altri terminali:
#   cd services/workout-service && npm run dev
#   cd services/progress-service && npm run dev
#   cd services/history-service && npm run dev
#   cd services/notify-service && npm run dev
#   cd services/api-gateway && npm run dev
#   cd apps/web && npm run dev             # webapp su http://localhost:5173
```

Oppure avvia tutto containerizzato:

```bash
docker compose up -d --build
curl http://localhost:4000/health   # api-gateway: unico punto di ingresso
```

## Provare la webapp a mano

Se il backend è già attivo (es. `docker compose ps` mostra i servizi
`healthy`), basta avviare la webapp:

```bash
cd apps/web
npm run dev
```

e aprire **http://localhost:5173**.

Per ripartire da zero (macchina appena riavviata, container fermi):

```bash
docker compose up -d   # infrastruttura + servizi

# solo la prima volta o dopo un nuovo checkout/pull
npm run db:migrate --workspace=@gym-tracker/account-service
npm run db:migrate --workspace=@gym-tracker/workout-service
npm run db:migrate --workspace=@gym-tracker/progress-service
npm run db:migrate --workspace=@gym-tracker/history-service
npm run db:migrate --workspace=@gym-tracker/notify-service

cd apps/web && npm run dev   # webapp su http://localhost:5173
```

Flusso di prova consigliato una volta dentro l'app:

1. Registrati e fai login.
2. **Schede** → crea una scheda impostando un "Incremento di progressione"
   su almeno un esercizio.
3. Apri la scheda → **Registra sessione** due volte di seguito con gli
   stessi valori (target raggiunto entrambe le volte): al secondo log
   dovrebbe comparire un suggerimento di progressione, sia nella conferma
   sia come badge sulla scheda.
4. **Storico** (nella barra di navigazione) → verifica le sessioni registrate
   e il loro dettaglio.
5. **Notifiche** (nella barra di navigazione, con il badge del numero di non
   lette) → il suggerimento del punto 3 dovrebbe comparire qui; segnalo come
   letto e verifica che il badge si aggiorni.

Per ispezionare la coda RabbitMQ `progression-events` (consumata
automaticamente da `notify-service`, che genera la notifica del punto 5):
http://localhost:15672 (utente/password di default: `gymtracker`/`gymtracker`).

6. **Password dimenticata** (link nella pagina di login) → richiedi il reset,
   poi apri http://localhost:8025 (Mailpit) per leggere l'email e seguire il
   link di reset.
7. **Profilo** (clic sulla tua email nella barra di navigazione) → cambia
   password: dopo aver inserito password attuale e nuova, il codice di
   conferma arriva anch'esso su Mailpit.

## Comandi principali

| Comando          | Cosa fa                         |
| ---------------- | ------------------------------- |
| `npm run lint`   | Lint su tutti i workspace       |
| `npm run test`   | Test su tutti i workspace       |
| `npm run build`  | Build su tutti i workspace      |
| `npm run format` | Formatta il codice con Prettier |

## Log

Ogni servizio logga in JSON strutturato (`pino`, vedi "Architettura" sopra),
non pensato per essere letto a occhio così com'è.

Via Docker Compose (come girano normalmente i servizi):

```bash
docker compose logs -f                    # tutti i servizi, interlacciati, segue in tempo reale
docker compose logs -f account-service    # solo un servizio
docker compose logs --tail 100 api-gateway  # ultime 100 righe, senza seguire
```

Per un formato leggibile invece del JSON grezzo (`--no-log-prefix` è
necessario: senza, `docker compose logs` antepone `<servizio>-1  |` a ogni
riga, che rompe il parsing JSON di pino-pretty e fa stampare le righe grezze
invece di formattarle):

```bash
docker compose logs -f --no-log-prefix api-gateway | npx pino-pretty
```

Su Windows con **PowerShell** questo pipe può restare bloccato senza
stampare nulla (buffering nativo-a-nativo tra `docker` e `node`, non
riproducibile in **Git Bash**, dove il comando sopra funziona senza
problemi): se capita, usa Git Bash per questo comando, oppure disaccoppia
cattura e formattazione con un file (in un altro terminale, dopo aver
lasciato girare un po' il primo comando):

```powershell
# terminale 1: scrive i log su file in continuo
docker compose logs -f --no-log-prefix api-gateway > gateway.ndjson
# terminale 2: rilegge e segue il file, aggirando il pipe nativo-a-nativo
Get-Content gateway.ndjson -Wait | npx pino-pretty
```

Per seguire una singola richiesta attraverso più servizi (es. capire perché
una chiamata dal gateway è arrivata "storta" a un servizio a valle): ogni
richiesta porta un `X-Request-Id` propagato invariato (vedi "Architettura"),
prendine uno dai log o dalla risposta HTTP e filtra:

```bash
docker compose logs | grep <request-id>
```

Se un servizio gira sull'host (`npm run dev`, fuori da Docker) i log JSON
escono direttamente sul terminale di quel processo, stesso formato.
L'header `Authorization` è sempre redatto (`[Redacted]`) nei log, anche
sulle risposte 401, quindi è sicuro incollarli altrove senza esporre token.

## Produzione (locale)

Un secondo stack Docker Compose, isolato da quello di sviluppo (container,
rete, volumi e porte tutti diversi, così i due non si mescolano mai anche
girando sulla stessa macchina): `docker-compose.prod.yml` invece di
`docker-compose.yml`, con il proprio file di variabili `.env.production`
invece di `.env`. Include anche la webapp (`apps/web`), containerizzata qui
per la prima volta (in dev gira solo con `npm run dev`).

**Va sempre avviato con il file esplicito**, mai con un semplice
`docker compose up` (che userebbe lo stack di dev):

```bash
# solo la prima volta
cp .env.production.example .env.production
# poi apri .env.production e sostituisci OGNI segnaposto CAMBIAMI/
# CONFIGURA_SMTP_REALE con un valore vero (vedi i commenti nel file per
# come generare un JWT_SECRET forte) -- non lasciare i default di esempio

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

Le porte pubblicate sono diverse da quelle di dev (schema "porta di dev +
1000": gateway su `5000` invece di `4000`, Postgres su `6432` invece di
`5432`, ecc. — vedi `.env.production.example` per l'elenco completo), così
i due stack possono girare **contemporaneamente** senza conflitti. La
webapp è su `http://localhost:8080` (nginx, build statica — non
`npm run dev`).

**Migrazioni**: le tabelle non esistono finché non le crei, esattamente
come per lo stack di dev. Vanno lanciate dall'host puntando `DATABASE_URL`
al Postgres di produzione (mai scambiare/rinominare `.env`/`.env.production`
per farlo — basta anteporre la variabile al comando, che ha la precedenza
su quella caricata da `.env`):

```bash
DATABASE_URL=postgres://gymtracker:<password>@localhost:6432/gymtracker \
  npm run db:migrate --workspace=@gym-tracker/account-service
# ripeti per workout-service, progress-service, history-service (dopo
# progress-service, riusa le sue tabelle), notify-service
```

**Limite noto**: nessun Mailpit in produzione (a differenza di dev) e
nessun relay SMTP configurato di default — le email (reset password,
avviso dead-letter) falliscono finché `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
`SMTP_PASSWORD` in `.env.production` non puntano a un vero server SMTP
autenticato (es. Gmail risponde "530-5.7.0 Authentication Required" senza
`SMTP_USER`/`SMTP_PASSWORD` — vedi i commenti in `.env.production.example`
per come generare una password per le app di Gmail). È un TODO esplicito,
non un bug: il resto dell'app funziona normalmente.

## App mobile

Fase 8 della roadmap: un client mobile che copra tutte le funzionalità della
webapp, parlando solo con l'API Gateway (stessa regola di `apps/web`, mai
un servizio contattato direttamente). Piano dettagliato e mockup validati
il 2026-08-02. Tutte e 10 le sotto-fasi implementate (`apps/mobile`): setup del
progetto Expo, tema "Night Track", navigazione a tab, autenticazione
funzionante (login/registrazione) contro il backend reale, elenco/dettaglio
schede (nome, note, esercizi con
set/reps/peso/recupero), creazione/modifica di una scheda (form condiviso
con esercizi/set dinamici, picker esercizi dal catalogo, riordino
esercizi con pulsanti ↑/↓ — non drag-and-drop come nella webapp, vedi
nota sotto), duplica/elimina scheda (azioni nella schermata di dettaglio,
non nella lista — scelta fatta con l'utente via un artifact di confronto
tra le due opzioni), registra sessione (form di log con precompilazione
dallo storico/preferenze utente, timer di recupero con vibrazione via
expo-haptics — solo a schermo acceso/app in primo piano, nessuna notifica
in background — e suggerimenti di progressione mostrati dopo il
salvataggio), storico (sessioni con divisore di settimana e ordinamento,
misure con delta rispetto alla rilevazione precedente, eliminazione di
entrambe con conferma), dashboard (statistiche, suggerimenti di
progressione con azione "Accetta", progressioni per esercizio con
mini-grafici a linea per gruppo muscolare, misure con sparkline,
calendario di costanza, prossima/ultima sessione, esercizio in stallo —
grafici disegnati con `react-native-svg`, libreria puramente JS+SVG senza
dipendenze reanimated/skia/worklets per restare compatibile con Expo Go,
vedi nota sotto), statistiche (stessa card riepilogo di Statistiche/
Dashboard più grafici a linea completi — non collassati in un accordion
come sulla Dashboard, c'è spazio dedicato — per ogni esercizio delle
schede attuali raggruppati per gruppo muscolare, e per ognuna delle 5
misure corporee), notifiche (elenco completo — lette e non —, badge non
lette condiviso tra la tab bar e la Dashboard tramite un context React,
segna come letta/tutte lette, accetta/accetta tutte le progressioni
pendenti) e profilo (tab Misure — stesso toggle "storicizza le misure" e
gli stessi 6 campi corpo della webapp — e tab Preferenze — sessioni
consecutive richieste, ambito di raggruppamento della progressione,
ambito di precompilazione ultime ripetizioni, suono sveglia a fine
recupero; niente tab Account/cambio password, fuori scope per questa
sotto-fase — accessibile da un'icona condivisa nell'header di tutte e 5
le tab, non da un'unica barra di navigazione globale come nella webapp,
che sul mobile non esiste).

Decisioni prese:

- **Stack**: React Native + Expo (TypeScript), non un'app Android nativa —
  un solo codebase per Android e iOS, con `@gym-tracker/shared` importato
  direttamente per i tipi/contratti (stesso schema già usato da `apps/web`).
- **Posizione**: nuovo workspace `apps/mobile` in questo stesso monorepo
  (non un repo separato) — toolchain npm-based come il resto del progetto.
- **Bundle identifier/applicationId**: `com.gymtracker.app`.
- **Versioni minime**: iOS 15+, Android 8.0+ (API 26).
- **Distribuzione**: solo uso personale per ora (Expo Go per sviluppo/test,
  EAS Build per eventuali build installabili) — nessuna pubblicazione sugli
  store, quindi nessun account Apple Developer necessario per ora.
- **Lingua**: multi-lingua fin dal principio (i18next/react-i18next +
  expo-localization; partenza italiano + inglese), a differenza della
  webapp che oggi ha l'italiano hardcoded. I messaggi di errore restano
  però in italiano lato backend: l'app mappa i `code` di `ApiError` su un
  proprio catalogo di traduzioni, col `message` italiano come fallback.
- **Riordino liste senza drag-and-drop nativo**: il riordino esercizi nel
  form "Nuova scheda" usa due pulsanti ↑/↓ invece del drag-and-drop della
  webapp (dnd-kit). Motivo: la libreria RN equivalente
  (`react-native-draggable-flatlist`) richiede `react-native-reanimated`
  4.x, il cui modulo nativo (`react-native-worklets`) manda in crash **Expo
  Go** (SIGSEGV nativo, versione del binario non compatibile con quella
  bundlata in Expo Go) — testato e verificato su questo progetto. Finché
  lo sviluppo passa da Expo Go (non da una dev build EAS custom),
  reanimated resta da evitare per qualunque nuova interazione a gesture.
- **Card della Dashboard con più elementi: swipe invece di pulsanti
  freccia** (`PagerControls`/`usePager`, rimossi). Ogni card scorre nella
  stessa direzione delle frecce che sostituisce, non una direzione fissa
  per tutte: verticale (su/giù) per Suggerimenti di progressione,
  Prossima/Ultima sessione — liste di righe, stessa direzione dello
  scroll della pagina in cui sono annidate, ma con una zona di
  trascinamento volutamente bassa (una riga + un accenno della
  successiva) per non creare ambiguità col gesto; orizzontale (laterale)
  per Gruppi muscolare, perché i riquadri restano affiancati in riga come
  oggi (nessun cambio di layout) e non ha alcun conflitto col scroll
  verticale della pagina. Validato con un mockup interattivo (HTML) prima
  di implementare. Un solo elemento alla volta invece della finestra di
  2-3 della versione a frecce: indicatore "N di M" testuale, niente
  frecce da mantenere/tradurre.
- **Tablet: fuori scope, esplicitamente in coda** (non nella Fase 8
  sopra). Oggi già escluso di fatto da `app.json`
  (`"orientation": "portrait"` globale, `ios.supportsTablet: false`): un
  eventuale supporto va valutato come iniziativa a sé quando/se richiesta,
  non implicito in nessuna sotto-fase attuale.

Verifica: sviluppo e test avvengono su un telefono reale via app **Expo
Go** (scan di un QR code), senza installare alcun SDK nativo sulla
macchina di sviluppo — build installabili (APK/IPA) quando servono
passano da **EAS Build** (cloud). Implementazione a sotto-fasi
incrementali (una PR alla volta), a partire dal solo setup del progetto +
autenticazione.

## CI/CD

Ogni Pull Request verso `master` esegue automaticamente (`.github/workflows/ci.yml`):

1. Lint su tutti i workspace
2. Test su tutti i workspace
3. Build TypeScript su tutti i workspace
4. Format check (`npm run format:check`, Prettier) — verificare in locale con
   `npm run format:check` prima di aprire una PR, `npm run format` per
   correggere
5. Build dell'immagine Docker di ogni servizio implementato (`account-service`, `workout-service`, `progress-service`, `history-service`, `notify-service`, `api-gateway`)

La validazione obbligatoria delle PR è **attiva**: su `master` è impostata una
branch protection rule con il check `CI passed` (il job `ci-status` del workflow)
come required status check, quindi una PR non è mergiabile finché la CI non è verde.

## Roadmap del progetto (percorso didattico)

✅ = fatto · ⬜ = da fare. Dalla Fase 1 in poi, ogni fase è divisa in backend
e UI: si spuntano indipendentemente, la fase è completa solo quando lo sono
entrambi.

- ✅ **Fase 0** — repo, CI/CD, Docker Compose
- ✅ **Fase 1** — account-service (registrazione, login, JWT)
  - ✅ Backend
  - ✅ UI (login, registrazione, dashboard protetta)
- ✅ **Fase 2** — workout-service (schede, esercizi, set/reps/peso/recupero)
  - ✅ Backend
  - ✅ UI (lista, creazione, dettaglio schede)
- ✅ **Fase 3** — progress-service + motore di regole di progressione
  - ✅ Backend
  - ✅ UI (registra sessione, storico, suggerimenti di progressione)
- ✅ **Fase 4** — notify-service
  - ✅ Backend
  - ✅ UI (badge notifiche non lette, elenco, segna come letta/tutte lette)
- ✅ **Fase 5** — hardening API Gateway (autenticazione centralizzata, rate
  limiting) + rifinitura webapp
  - ✅ Hardening API Gateway
  - ✅ Rifinitura webapp
- ✅ **Fase 6** — osservabilità leggera (log strutturati + correlation ID)
- ⬜ **Fase 7** — Kubernetes (opzionale)
- ✅ **Fase 8** — app mobile (React Native, Android + iOS)

L'API Gateway in versione minima (solo reverse-proxy, vedi `services/api-gateway`)
è stato anticipato rispetto alla Fase 5 originale: serviva da subito per non
far parlare la webapp direttamente con i singoli servizi (vedi "Cosa NON fare"
in `CLAUDE.md`). L'hardening (autenticazione centralizzata, rate limiting) e
la rifinitura webapp (restyling "Night Track" completo su tutte le pagine,
standard responsive unico per le tabelle a larghezza fissa, storico misure)
sono entrambi arrivati in Fase 5. La Fase 8 è stata ripianificata il
2026-08-02: non più un'app Android nativa (Kotlin) ma un client React
Native che copre Android e iOS con un solo codebase — vedi "App mobile"
più sopra per le decisioni prese; tutte le 10 sotto-fasi implementate.

Vedi `CLAUDE.md` per le convenzioni di codice usate da Claude Code in questo
repo.

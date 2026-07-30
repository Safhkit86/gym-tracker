# gym-tracker

App di tracking allenamenti in palestra, costruita come progetto didattico
hands-on: monorepo a microservizi (Node.js/TypeScript), Docker, CI/CD con
validazione automatica delle PR — pensato per essere consumato sia da una
web app che, in futuro, da un'app Android, tramite un API Gateway condiviso.

## Architettura

```
Web app (apps/web) / Android app (futuro)
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
- ⬜ **Fase 8** — app Android

L'API Gateway in versione minima (solo reverse-proxy, vedi `services/api-gateway`)
è stato anticipato rispetto alla Fase 5 originale: serviva da subito per non
far parlare la webapp direttamente con i singoli servizi (vedi "Cosa NON fare"
in `CLAUDE.md`). L'hardening (autenticazione centralizzata, rate limiting) e
la rifinitura webapp (restyling "Night Track" completo su tutte le pagine,
standard responsive unico per le tabelle a larghezza fissa, storico misure)
sono entrambi arrivati in Fase 5.

Vedi `CLAUDE.md` per le convenzioni di codice usate da Claude Code in questo
repo.

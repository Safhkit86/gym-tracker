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
   ┌────────┼────────┬─────────┐
   │        │        │         │
 Auth   Workout   Progress   Notify
   │        │        │         │
   └────────┴────────┴─────────┘
                │
   PostgreSQL · Redis · RabbitMQ
```

- **api-gateway** — unico punto di ingresso per i client: inoltra le richieste
  ai servizi (`/auth`, `/me` → auth-service; `/exercises`, `/workouts` →
  workout-service; `/sessions`, `/progression` → progress-service;
  `/notifications` → notify-service). Verifica centralmente il Bearer JWT
  (401 prima ancora di raggiungere un servizio a valle, tranne su
  `/auth/register` e `/auth/login`, pubblici) e applica un rate limit per IP
  (più stringente su `/auth`) — in aggiunta, non in sostituzione, alla
  verifica che ogni servizio fa comunque per conto proprio.
- **auth-service** — utenti, JWT (Fase 1)
- **workout-service** — schede, esercizi, set/reps/peso/recupero (Fase 2)
- **progress-service** — storico allenamenti + motore di regole di
  progressione (Fase 3)
- **notify-service** — notifiche quando una regola di progressione scatta
  (Fase 4)

- **web** (`apps/web`) — React + Vite + TypeScript, CSS semplice, fetch
  nativo. Parla solo con `api-gateway`, mai con i singoli servizi.

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
npm run db:migrate --workspace=@gym-tracker/auth-service      # crea le tabelle
npm run db:migrate --workspace=@gym-tracker/workout-service   # crea le tabelle + seed catalogo
npm run db:migrate --workspace=@gym-tracker/progress-service  # crea le tabelle
npm run db:migrate --workspace=@gym-tracker/notify-service    # crea le tabelle
cd services/auth-service && npm run dev         # avvia auth-service in watch mode
# in altri terminali:
#   cd services/workout-service && npm run dev
#   cd services/progress-service && npm run dev
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
npm run db:migrate --workspace=@gym-tracker/auth-service
npm run db:migrate --workspace=@gym-tracker/workout-service
npm run db:migrate --workspace=@gym-tracker/progress-service
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

## Comandi principali

| Comando          | Cosa fa                         |
| ---------------- | ------------------------------- |
| `npm run lint`   | Lint su tutti i workspace       |
| `npm run test`   | Test su tutti i workspace       |
| `npm run build`  | Build su tutti i workspace      |
| `npm run format` | Formatta il codice con Prettier |

## CI/CD

Ogni Pull Request verso `master` esegue automaticamente (`.github/workflows/ci.yml`):

1. Lint su tutti i workspace
2. Test su tutti i workspace
3. Build TypeScript su tutti i workspace
4. Build dell'immagine Docker di ogni servizio implementato (`auth-service`, `workout-service`, `progress-service`, `notify-service`, `api-gateway`)

La validazione obbligatoria delle PR è **attiva**: su `master` è impostata una
branch protection rule con il check `CI passed` (il job `ci-status` del workflow)
come required status check, quindi una PR non è mergiabile finché la CI non è verde.

## Roadmap del progetto (percorso didattico)

✅ = fatto · ⬜ = da fare. Dalla Fase 1 in poi, ogni fase è divisa in backend
e UI: si spuntano indipendentemente, la fase è completa solo quando lo sono
entrambi.

- ✅ **Fase 0** — repo, CI/CD, Docker Compose
- ✅ **Fase 1** — auth-service (registrazione, login, JWT)
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
- **Fase 5** — hardening API Gateway (autenticazione centralizzata, rate
  limiting) + rifinitura webapp
  - ✅ Hardening API Gateway
  - ⬜ Rifinitura webapp
- ⬜ **Fase 6** — osservabilità (log, metriche, tracing)
- ⬜ **Fase 7** — Kubernetes (opzionale)
- ⬜ **Fase 8** — app Android

L'API Gateway in versione minima (solo reverse-proxy, vedi `services/api-gateway`)
è stato anticipato rispetto alla Fase 5 originale: serviva da subito per non
far parlare la webapp direttamente con i singoli servizi (vedi "Cosa NON fare"
in `CLAUDE.md`). L'hardening (autenticazione centralizzata, rate limiting) è
arrivato in Fase 5; la "rifinitura webapp" resta da fare, senza uno scope
preciso ancora definito.

Vedi `CLAUDE.md` per le convenzioni di codice usate da Claude Code in questo
repo.

# gym-tracker

App di tracking allenamenti in palestra, costruita come progetto didattico
hands-on: monorepo a microservizi (Node.js/TypeScript), Docker, CI/CD con
validazione automatica delle PR — pensato per essere consumato sia da una
web app che, in futuro, da un'app Android, tramite un API Gateway condiviso.

## Architettura

```
Web app (apps/web, in costruzione) / Android app (futuro)
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
  workout-service). Per ora solo reverse-proxy; autenticazione centralizzata
  e rate limiting arriveranno con l'hardening previsto in Fase 5.
- **auth-service** — utenti, JWT (Fase 1)
- **workout-service** — schede, esercizi, set/reps/peso/recupero (Fase 2)
- **progress-service** — storico allenamenti + motore di regole di
  progressione (Fase 3)
- **notify-service** — notifiche quando una regola di progressione scatta
  (Fase 4)

- **web** (`apps/web`) — React + Vite + TypeScript, CSS semplice, fetch
  nativo. Parla solo con `api-gateway`, mai con i singoli servizi.

Dalla Fase 3 in poi, ogni fase backend include anche la parte di interfaccia
web corrispondente (dove serve), invece di costruire tutta la webapp in blocco
alla fine: si parte comunque da un ricongiungimento per auth-service e
workout-service (Fase 1 e 2), gia' completi lato backend — login/registrazione
sono gia' coperti, la UI delle schede (Fase 2) e' il prossimo passo.

## Requisiti

- Node.js ≥ 20
- Docker + Docker Compose

## Setup locale

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis rabbitmq   # solo infrastruttura
npm run build --workspace=@gym-tracker/shared
npm run db:migrate --workspace=@gym-tracker/auth-service      # crea le tabelle
npm run db:migrate --workspace=@gym-tracker/workout-service   # crea le tabelle + seed catalogo
cd services/auth-service && npm run dev         # avvia auth-service in watch mode
# in altri terminali:
#   cd services/workout-service && npm run dev
#   cd services/api-gateway && npm run dev
#   cd apps/web && npm run dev             # webapp su http://localhost:5173
```

Oppure avvia tutto containerizzato:

```bash
docker compose up -d --build
curl http://localhost:4000/health   # api-gateway: unico punto di ingresso
```

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
4. Build dell'immagine Docker di ogni servizio implementato (`auth-service`, `workout-service`, `api-gateway`)

La validazione obbligatoria delle PR è **attiva**: su `master` è impostata una
branch protection rule con il check `CI passed` (il job `ci-status` del workflow)
come required status check, quindi una PR non è mergiabile finché la CI non è verde.

## Roadmap del progetto (percorso didattico)

- [x] **Fase 0** — repo, CI/CD, Docker Compose
- [x] **Fase 1** — auth-service completo (registrazione, login, JWT) + UI
      (login, registrazione, dashboard protetta) _(completata)_
- [x] **Fase 2** — workout-service (schede, esercizi): backend completo, UI in arrivo
- [ ] **Fase 3** — progress-service + motore di regole di progressione
- [ ] **Fase 4** — notify-service
- [ ] **Fase 5** — hardening API Gateway (autenticazione centralizzata, rate
      limiting) + rifinitura webapp
- [ ] **Fase 6** — osservabilità (log, metriche, tracing)
- [ ] **Fase 7** — Kubernetes (opzionale)
- [ ] **Fase 8** — app Android

L'API Gateway in versione minima (solo reverse-proxy, vedi `services/api-gateway`)
è stato anticipato rispetto alla Fase 5 originale: serviva da subito per non
far parlare la webapp direttamente con i singoli servizi (vedi "Cosa NON fare"
in `CLAUDE.md`). La Fase 5 resta per l'hardening (auth centralizzata, rate
limiting) quando servirà.

Vedi `CLAUDE.md` per le convenzioni di codice usate da Claude Code in questo
repo.

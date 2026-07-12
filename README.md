# gym-tracker

App di tracking allenamenti in palestra, costruita come progetto didattico
hands-on: monorepo a microservizi (Node.js/TypeScript), Docker, CI/CD con
validazione automatica delle PR — pensato per essere consumato sia da una
web app che, in futuro, da un'app Android, tramite un API Gateway condiviso.

## Architettura

```
Web app / Android app (futuro)
            │
       API Gateway            (Fase 5, TODO)
            │
   ┌────────┼────────┬─────────┐
   │        │        │         │
 Auth   Workout   Progress   Notify
   │        │        │         │
   └────────┴────────┴─────────┘
                │
   PostgreSQL · Redis · RabbitMQ
```

- **auth-service** — utenti, JWT (implementato in questa fase)
- **workout-service** — schede, esercizi, set/reps/peso/recupero (Fase 2)
- **progress-service** — storico allenamenti + motore di regole di
  progressione (Fase 3)
- **notify-service** — notifiche quando una regola di progressione scatta
  (Fase 4)

## Requisiti

- Node.js ≥ 20
- Docker + Docker Compose

## Setup locale

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis rabbitmq   # solo infrastruttura
npm run build --workspace=@gym-tracker/shared
cd services/auth-service && npm run dev         # avvia auth-service in watch mode
```

Oppure avvia tutto containerizzato:

```bash
docker compose up -d --build
curl http://localhost:4001/health
```

## Comandi principali

| Comando          | Cosa fa                         |
| ---------------- | ------------------------------- |
| `npm run lint`   | Lint su tutti i workspace       |
| `npm run test`   | Test su tutti i workspace       |
| `npm run build`  | Build su tutti i workspace      |
| `npm run format` | Formatta il codice con Prettier |

## CI/CD

Ogni Pull Request verso `main` esegue automaticamente (`.github/workflows/ci.yml`):

1. Lint su tutti i workspace
2. Test su tutti i workspace
3. Build TypeScript su tutti i workspace
4. Build dell'immagine Docker di `auth-service`

**Per attivare la validazione obbligatoria delle PR su GitHub:**
Settings → Branches → Branch protection rule su `main` → abilita
"Require status checks to pass before merging" e seleziona il check
`CI passed` (il job `ci-status` del workflow).

## Roadmap del progetto (percorso didattico)

- [x] **Fase 0** — repo, CI/CD, Docker Compose _(questa fase)_
- [ ] **Fase 1** — auth-service completo (registrazione, login, JWT)
- [ ] **Fase 2** — workout-service (schede, esercizi)
- [ ] **Fase 3** — progress-service + motore di regole di progressione
- [ ] **Fase 4** — notify-service
- [ ] **Fase 5** — API Gateway + web app (React)
- [ ] **Fase 6** — osservabilità (log, metriche, tracing)
- [ ] **Fase 7** — Kubernetes (opzionale)
- [ ] **Fase 8** — app Android

Vedi `CLAUDE.md` per le convenzioni di codice usate da Claude Code in questo
repo.

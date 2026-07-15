# gym-tracker — convenzioni per Claude Code

Monorepo a microservizi (Node.js/TypeScript, npm workspaces) per un'app di
tracking allenamenti in palestra. Vedi README.md per l'architettura completa.

## Struttura

- `packages/shared` — tipi e contratti condivisi tra i servizi
- `services/auth-service` — utenti, autenticazione, JWT (implementato)
- `services/workout-service` — schede/esercizi (implementato)
- `services/api-gateway` — unico punto di ingresso per i client, reverse-proxy
  verso i servizi (implementato in forma minima)
- `services/progress-service` — storico + regole di progressione (Fase 3, TODO)
- `services/notify-service` — notifiche (Fase 4, TODO)
- `apps/web` — webapp React/Vite/TypeScript, parla solo con `api-gateway`

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
- Niente `console.log` in produzione salvo il log di avvio del server
  (l'eslint rule `no-console` è a "warn", non "error", per questo motivo).
- Il `Dockerfile` di ogni servizio usa come build context la root del
  monorepo (necessario perché npm workspaces risolva `@gym-tracker/shared`).
  Ogni stage che esegue comandi npm con `--workspace` deve copiare il
  `package.json` (e `package-lock.json*`) di root, non solo quelli dei
  singoli workspace: senza il manifest di root, `/app` non è riconosciuto
  come workspace root e `npm run build --workspace=...` fallisce con
  `ENOENT: package.json`. Usa il Dockerfile di `auth-service` come modello.
- Ogni `src/config.ts` carica il `.env` di root con `dotenv` (vedi
  `services/auth-service/src/config.ts`) prima di validare lo schema zod:
  serve solo quando il servizio gira sull'host (`npm run dev`/`db:migrate`
  fuori da Docker), dove le variabili non arrivano già impostate come fa
  docker-compose. Non sovrascrive variabili già in `process.env` e non fa
  nulla se il file non esiste (dentro l'immagine Docker `.env` non c'è).
  Aggiungi questo stesso blocco al `config.ts` di ogni nuovo servizio.
- Tutti i servizi condividono lo stesso database Postgres (stesso
  `DATABASE_URL`, tabelle diverse per servizio): nel `Migrator` di Kysely
  (`src/db/migrate.ts`) imposta sempre `migrationTableName` e
  `migrationLockTableName` con un suffisso per servizio (es.
  `kysely_migration_auth`, `kysely_migration_workout`), altrimenti la tabella
  di tracking migrazioni di default (`kysely_migration`) collide tra servizi
  e la migrazione fallisce con "corrupted migrations".
- `apps/web` usa una versione di `vitest` diversa da quella dei servizi
  backend (backend su v2, frontend su v4, per compatibilità con Vite 8): npm
  tiene due copie separate (una in root, una annidata in `apps/web`). Un
  pacchetto hoisted in root che fa `expect.extend(...)` o `declare module
"vitest"` (es. `@testing-library/jest-dom`) risolve `vitest` da dove _lui_
  vive, non da dove girano i test — se le due copie non coincidono, i matcher
  non vengono registrati/i tipi non combaciano a runtime pur passando il
  typecheck. Vedi `apps/web/src/test/setup.ts` e `jest-dom.d.ts` per il
  workaround (importare `expect` ed estenderlo a mano dentro il workspace,
  invece di affidarsi all'entry point `/vitest` del pacchetto).
- `api-gateway` ha `cors()` globale perché la webapp (altra origine: Vite dev
  o un dominio statico) lo chiama via fetch da browser: senza CORS le
  richieste vengono bloccate lato client. Nessun altro servizio ne ha bisogno,
  la webapp non li chiama mai direttamente.
- Un restyling grafico di `apps/web` copre **tutte** le pagine esistenti, non
  solo quelle toccate dalla feature che lo ha motivato: prima di chiudere una
  PR di restyling, passa in rassegna ogni file in `src/pages/` e applica le
  stesse classi/pattern (es. `.card`) usate nelle altre pagine, così l'app non
  finisce con un mix di pagine vecchie e nuove.

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

## Comandi utili

```bash
npm install                        # installa tutte le dipendenze (root)
npm run lint                       # lint su tutti i workspace
npm run test                       # test su tutti i workspace
npm run build                      # build su tutti i workspace
docker compose up -d               # avvia infrastruttura + servizi
docker compose up -d postgres redis rabbitmq   # solo infrastruttura
```

## Cosa NON fare

- Non far comunicare i client (web/Android) direttamente con un servizio:
  passano sempre dall'API Gateway (`services/api-gateway`, implementato in
  forma minima come reverse-proxy; l'hardening con auth centralizzata e rate
  limiting è previsto in Fase 5). Quando aggiungi una rotta a un nuovo
  servizio, aggiungi anche il relativo `app.use(prefix, proxyTo(...))` nel
  gateway.
- Non duplicare tipi/contratti tra servizi: se un tipo serve a più di un
  servizio, va in `packages/shared`.

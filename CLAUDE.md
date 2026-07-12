# gym-tracker — convenzioni per Claude Code

Monorepo a microservizi (Node.js/TypeScript, npm workspaces) per un'app di
tracking allenamenti in palestra. Vedi README.md per l'architettura completa.

## Struttura

- `packages/shared` — tipi e contratti condivisi tra i servizi
- `services/auth-service` — utenti, autenticazione, JWT (implementato)
- `services/workout-service` — schede/esercizi (Fase 2, TODO)
- `services/progress-service` — storico + regole di progressione (Fase 3, TODO)
- `services/notify-service` — notifiche (Fase 4, TODO)

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
- Quando una fase del percorso didattico viene completata, aggiorna sempre la
  sezione "Roadmap del progetto" del `README.md`: spunta la casella della fase
  (`- [x]`) e sposta l'annotazione `_(completata)_` sulla fase appena conclusa.
  Fai rientrare questo aggiornamento nella stessa PR che completa la fase.

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
  passano sempre dall'API Gateway (Fase 5, non ancora implementato).
- Non duplicare tipi/contratti tra servizi: se un tipo serve a più di un
  servizio, va in `packages/shared`.

# web

Web app di gym-tracker: React + Vite + TypeScript, CSS semplice, fetch nativo
(niente query library per ora). Parla **solo** con `api-gateway` — mai
direttamente con i singoli servizi (vedi "Cosa NON fare" in `CLAUDE.md`).

Costruita incrementalmente: ogni fase backend aggiunge la propria fetta di
UI, invece di un'unica fase finale dedicata al frontend.

## Comandi

```bash
npm run dev --workspace=@gym-tracker/web     # dev server (Vite, HMR)
npm run test --workspace=@gym-tracker/web    # Vitest + Testing Library
npm run build --workspace=@gym-tracker/web   # build di produzione
```

Richiede `api-gateway` (e a cascata auth-service/workout-service, Postgres)
in esecuzione — vedi il README della root per il setup completo. L'URL del
gateway si configura con `VITE_API_BASE_URL` (default `http://localhost:4000`,
vedi `.env.example`).

## Struttura

- `src/api/` — client HTTP verso il gateway, un modulo per dominio (auth, ecc.)
- `src/auth/` — contesto di autenticazione (token in memoria + localStorage,
  redirect se non autenticato)
- `src/pages/` — una cartella/file per pagina, instradate con `react-router-dom`

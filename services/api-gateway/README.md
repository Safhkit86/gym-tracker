# api-gateway

Unico punto di ingresso per i client (web/Android): inoltra le richieste ai
servizi a monte. Per ora è solo un reverse-proxy (nessuna logica di
autenticazione propria — ogni servizio verifica il proprio JWT); l'hardening
(auth centralizzata, rate limiting) è previsto per la Fase 5.

## Routing

| Prefisso                      | Upstream          |
| ----------------------------- | ----------------- |
| `/auth/*`, `/me`              | `auth-service`    |
| `/exercises/*`, `/workouts/*` | `workout-service` |

`/health` è del gateway stesso e non viene proxato. Aggiungi un nuovo
`app.use(prefix, proxyTo(...))` in `src/app.ts` quando arriva un nuovo
servizio con rotte pubbliche.

## Comandi

```bash
npm run dev --workspace=@gym-tracker/api-gateway
npm run test --workspace=@gym-tracker/api-gateway
```

Vedi `requests.http` per esercitare le API attraverso il gateway.

# notify-service (Fase 4)

Consuma gli eventi di progressione pubblicati da `progress-service` (coda
RabbitMQ `progression-events`) e li trasforma in notifiche **in-app**: nessuna
infrastruttura email/push da configurare, le notifiche si consultano via REST
(la webapp le mostrerà in una PR UI successiva, stesso schema
backend-poi-UI delle fasi precedenti).

## Modello dati

`Notification`: una riga per ogni evento di progressione consumato
(esercizio, tipo di suggerimento, valore precedente/suggerito, motivo,
sessione che l'ha generato), con `readAt` nullo finché non viene segnata
come letta. Deduplicata per `(ownerId, progressionEventId)`: se RabbitMQ
riconsegna lo stesso messaggio (es. dopo un crash prima dell'ack), non
crea una seconda notifica.

## Consumer

All'avvio si connette a RabbitMQ (retry con backoff, stesso pattern del
publisher di `progress-service`) e consuma dalla coda `progression-events`
con ack manuale: un messaggio malformato viene loggato e scartato (nessun
dead-letter exchange in v1, per non bloccare la coda ritentando
all'infinito un messaggio che non potrà mai essere elaborato).

## Endpoint

Tutti richiedono `Authorization: Bearer <token>` emesso da `auth-service`.

| Metodo | Path                      | Descrizione                           |
| ------ | ------------------------- | ------------------------------------- |
| GET    | `/notifications`          | Elenco (con `?unread=true` opzionale) |
| PATCH  | `/notifications/:id/read` | Segna una notifica come letta         |
| POST   | `/notifications/read-all` | Segna tutte le notifiche come lette   |

Una notifica non tua risponde `404` (non `403`, per non rivelarne l'esistenza).

## Comandi

```bash
npm run dev --workspace=@gym-tracker/notify-service        # avvia in watch mode
npm run db:migrate --workspace=@gym-tracker/notify-service  # crea le tabelle
npm run test --workspace=@gym-tracker/notify-service
```

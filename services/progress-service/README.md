# progress-service (Fase 3)

Storico degli allenamenti eseguiti (esecuzione reale contro la prescrizione
di `workout-service`) e motore di regole di progressione (progressive
overload). Il client invia uno snapshot autosufficiente al log di ogni
sessione (esercizi, set, prescrizione al momento del log): progress-service
non chiama mai `workout-service` via HTTP.

## Progressione: manuale, non un valore fisso

L'incremento di progressione (kg per un esercizio pesato, ripetizioni per uno
a corpo libero) **non è una costante uguale per tutti gli esercizi**: si
imposta per esercizio nella scheda (`WorkoutExercise.progressionIncrement`,
vedi `@gym-tracker/shared`). Il motore di progress-service decide solo il
_quando_ (analizzando lo storico), mai il _quanto_: se un esercizio non ha un
incremento configurato, non viene proposto nessun suggerimento per quello
esercizio.

Ogni `ProgressionEvent` ha un campo `source` (oggi sempre `"rule"`): è
l'aggancio per una futura modalità "suggerita" in cui un'analisi
statistica/AI dello storico proponga essa stessa l'incremento — **non
implementata**, solo un seam nello schema per non richiedere una migrazione
distruttiva quando arriverà.

## Regola v1

Per un esercizio, dopo il log di una sessione: se nelle ultime 2 sessioni
consecutive per la stessa `(scheda, esercizio)` tutti i set con un obiettivo
di ripetizioni impostato sono stati completati (`actualReps >= targetReps`)
allo stesso peso, e l'esercizio ha un `progressionIncrement` configurato,
scatta un suggerimento (`increase_weight` se pesato, `increase_reps` se a
corpo libero) — pubblicato su RabbitMQ (coda `progression-events`, che
`notify-service` consumerà in Fase 4) e restituito subito nella risposta di
`POST /sessions`.

## Modello dati

`WorkoutSession` → `SessionSet` (esecuzione reale, con snapshot di nome
esercizio/obiettivo/incremento configurato al momento del log) e
`ProgressionEvent` (suggerimenti generati). `ownerId`/`workoutId`/`exerciseId`
non sono foreign key verso altri servizi (confine tra servizi, stesso
pattern di `workout-service`).

## Endpoint

Tutti richiedono `Authorization: Bearer <token>` emesso da `auth-service`.

| Metodo | Path            | Descrizione                             |
| ------ | --------------- | --------------------------------------- |
| POST   | `/sessions`     | Registra una sessione eseguita          |
| GET    | `/sessions`     | Elenco sintetico delle proprie sessioni |
| GET    | `/sessions/:id` | Dettaglio completo di una sessione      |
| DELETE | `/sessions/:id` | Elimina una sessione registrata         |
| GET    | `/progression`  | Suggerimenti di progressione recenti    |

Una sessione non tua risponde `404` (non `403`, per non rivelarne l'esistenza).

## Comandi

```bash
npm run dev --workspace=@gym-tracker/progress-service        # avvia in watch mode
npm run db:migrate --workspace=@gym-tracker/progress-service  # crea le tabelle
npm run test --workspace=@gym-tracker/progress-service
```

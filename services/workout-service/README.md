# workout-service (Fase 2)

Gestisce il catalogo esercizi e le schede di allenamento (set/reps/peso/recupero).
Modella la **prescrizione** (cosa fare); l'esecuzione reale sarà di `progress-service`.

## Modello dati

`Workout` → `WorkoutExercise` → `WorkoutSet` (3 livelli, così una scheda può
avere set diversi per reps/peso sullo stesso esercizio). Catalogo `Exercise`
con `ownerId` nullo per gli esercizi globali (seed) o valorizzato per quelli
creati dall'utente. `ownerId` sulle schede/esercizi è il `sub` del JWT: non è
una foreign key verso `auth-service` (confine tra servizi).

Ogni `WorkoutExercise` può avere un `progressionIncrement` (kg se pesato,
ripetizioni a corpo libero): è il _quanto_ di progressione per quell'esercizio
in quella scheda, letto da `progress-service` (Fase 3) per i suoi
suggerimenti — non un valore fisso uguale per tutti gli esercizi.

## Endpoint

Tutti richiedono `Authorization: Bearer <token>` emesso da `auth-service`.

| Metodo | Path            | Descrizione                               |
| ------ | --------------- | ----------------------------------------- |
| GET    | `/exercises`    | Elenco esercizi globali + propri          |
| POST   | `/exercises`    | Crea un esercizio personale               |
| POST   | `/workouts`     | Crea una scheda completa (esercizi + set) |
| GET    | `/workouts`     | Elenco sintetico delle proprie schede     |
| GET    | `/workouts/:id` | Dettaglio completo di una scheda          |
| PUT    | `/workouts/:id` | Sostituisce l'intera scheda               |
| DELETE | `/workouts/:id` | Elimina una scheda                        |

Una scheda non tua risponde `404` (non `403`, per non rivelarne l'esistenza).

## Comandi

```bash
npm run dev --workspace=@gym-tracker/workout-service        # avvia in watch mode
npm run db:migrate --workspace=@gym-tracker/workout-service  # crea le tabelle + seed catalogo
npm run test --workspace=@gym-tracker/workout-service
```

Vedi `requests.http` per esercitare le API a mano (estensione VS Code REST Client).

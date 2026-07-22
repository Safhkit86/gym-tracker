import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Exercise, WorkoutInput } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { listExercises } from "../api/exercises";
import { createWorkout } from "../api/workouts";
import { ApiRequestError } from "../api/client";
import { WorkoutForm } from "../components/WorkoutForm";

export function CreateWorkoutPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    listExercises(token)
      .then((result) => setCatalog(result))
      .catch((err: unknown) => {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : "Impossibile caricare il catalogo esercizi."
        );
      });
  }, [token]);

  async function handleSubmit(input: WorkoutInput): Promise<void> {
    if (!token) {
      return;
    }
    const result = await createWorkout(token, input);
    navigate(`/workouts/${result.id}`);
  }

  if (error) {
    return (
      <main>
        <p role="alert" className="form-error">
          {error}
        </p>
      </main>
    );
  }

  if (catalog === null) {
    return (
      <main>
        <p>Caricamento…</p>
      </main>
    );
  }

  if (catalog.length === 0) {
    return (
      <main>
        <p>Nessun esercizio disponibile nel catalogo.</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <h1>Nuova scheda</h1>
      <WorkoutForm
        catalog={catalog}
        submitLabel="Crea scheda"
        submittingLabel="Salvataggio…"
        onSubmit={handleSubmit}
      />
    </main>
  );
}

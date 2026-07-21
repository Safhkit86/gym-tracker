import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Exercise, WorkoutInput } from "@gym-tracker/shared";
import { useAuth } from "../auth/useAuth";
import { listExercises } from "../api/exercises";
import { getWorkout, updateWorkout } from "../api/workouts";
import { ApiRequestError } from "../api/client";
import { WorkoutForm } from "../components/WorkoutForm";
import { workoutDetailToFormValues } from "../components/workout-form-utils";

export function EditWorkoutPage() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [initial, setInitial] = useState<ReturnType<typeof workoutDetailToFormValues> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) {
      return;
    }
    Promise.all([listExercises(token), getWorkout(token, id)])
      .then(([exercises, workout]) => {
        setCatalog(exercises);
        setInitial(workoutDetailToFormValues(workout));
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err.message : "Impossibile caricare la scheda.");
      });
  }, [token, id]);

  async function handleSubmit(input: WorkoutInput): Promise<void> {
    if (!token || !id) {
      return;
    }
    await updateWorkout(token, id, input);
    navigate(`/workouts/${id}`);
  }

  if (error) {
    return (
      <main>
        <p role="alert" className="form-error">
          {error}
        </p>
        <Link to="/workouts">Torna alle schede</Link>
      </main>
    );
  }

  if (catalog === null || initial === null) {
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
    <main>
      <h1>Modifica scheda</h1>
      <WorkoutForm
        catalog={catalog}
        initialName={initial.name}
        initialNotes={initial.notes}
        initialExercises={initial.exercises}
        submitLabel="Salva modifiche"
        submittingLabel="Salvataggio…"
        onSubmit={handleSubmit}
      />
    </main>
  );
}

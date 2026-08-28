import type { Exercise } from "@gym-tracker/shared";
import { createExercise } from "../api/exercises";

/** Chiave di cache case-insensitive per nome esercizio. */
function cacheKey(name: string): string {
  return name.trim().toLowerCase();
}

export function buildExerciseCache(catalog: Exercise[]): Map<string, Exercise> {
  return new Map(catalog.map((e) => [cacheKey(e.name), e]));
}

/** Risolve un nome esercizio in un id del catalogo di chi importa: match
 *  per nome case-insensitive; se non trovato, crea un nuovo esercizio
 *  personale con quel nome (e muscleGroup, se presente). `cache` viene
 *  aggiornata così due schede/sessioni nello stesso file che citano lo
 *  stesso esercizio non ancora esistente non ne creano due copie.
 *  Sequenziale per costruzione (un await per chiamata): usato dentro un
 *  ciclo `for...of`, mai `Promise.all`, apposta — evita che lo stesso nome
 *  nuovo, ripetuto due volte nello stesso file, venga creato due volte per
 *  una corsa sulla cache condivisa. */
export async function resolveExerciseId(
  token: string,
  name: string,
  muscleGroup: string | null | undefined,
  cache: Map<string, Exercise>
): Promise<string> {
  const key = cacheKey(name);
  const existing = cache.get(key);
  if (existing) {
    return existing.id;
  }
  const created = await createExercise(token, {
    name: name.trim(),
    muscleGroup: muscleGroup ?? undefined,
  });
  cache.set(key, created);
  return created.id;
}

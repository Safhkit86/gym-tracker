/** Forma di errore uniforme restituita da tutti i servizi. */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

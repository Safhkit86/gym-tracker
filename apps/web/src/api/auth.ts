import type {
  AuthResponse,
  ConfirmPasswordChangeRequest,
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponse,
  PublicUser,
  RegisterRequest,
  RequestPasswordChangeRequest,
  ResetPasswordRequest,
} from "@gym-tracker/shared";
import { apiRequest } from "./client";

export function register(body: RegisterRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", { method: "POST", body });
}

export function login(body: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", { method: "POST", body });
}

export function me(token: string): Promise<PublicUser> {
  return apiRequest<PublicUser>("/me", { token });
}

/** Rinnova il token corrente (stessa scadenza fissa "1h" del token
 *  originale, riemesso da capo): richiede un token ancora valido, va
 *  richiamato PRIMA che scada. Vedi useSlidingSession. */
export function refreshToken(token: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/me/token/refresh", { method: "POST", token });
}

export function forgotPassword(body: ForgotPasswordRequest): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/forgot-password", { method: "POST", body });
}

export function resetPassword(body: ResetPasswordRequest): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/reset-password", { method: "POST", body });
}

export function requestPasswordChange(
  token: string,
  body: RequestPasswordChangeRequest
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/me/password/change-request", {
    method: "POST",
    body,
    token,
  });
}

export function confirmPasswordChange(
  token: string,
  body: ConfirmPasswordChangeRequest
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/me/password/change-confirm", {
    method: "POST",
    body,
    token,
  });
}

/** Diritto alla portabilita' dei dati (GDPR): solo i dati di account-service
 *  (profilo, misure, preferenze) — il resto (schede, sessioni, notifiche,
 *  suggerimenti di progressione) e' aggregato lato client dalle rotte
 *  esistenti, vedi ../export/export-account-data.ts. Nessun tipo condiviso
 *  dedicato in @gym-tracker/shared: e' solo questa pagina a consumarlo,
 *  stesso trattamento di altri DTO specifici di una sola rotta. */
export interface AccountDataExport {
  profile: { id: string; email: string; createdAt: string };
  measurements: { heightCm: number | null };
  accountPreferences: {
    prefillScope: string;
    timerSoundEnabled: boolean;
    historicizeMeasurements: boolean;
  };
}

export function exportAccountData(token: string): Promise<AccountDataExport> {
  return apiRequest<AccountDataExport>("/me/export", { token });
}

/** Diritto all'oblio (GDPR): cancella l'account e, lato server, pubblica
 *  (best-effort) la pulizia cross-servizio — vedi AccountDeletionService in
 *  account-service. 204 No Content, apiRequest torna undefined. */
export function deleteAccount(token: string): Promise<undefined> {
  return apiRequest<undefined>("/me", { method: "DELETE", token });
}

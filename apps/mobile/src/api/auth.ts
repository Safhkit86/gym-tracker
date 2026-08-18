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

export function forgotPassword(body: ForgotPasswordRequest): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/forgot-password", { method: "POST", body });
}

export function resetPassword(body: ResetPasswordRequest): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/reset-password", { method: "POST", body });
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

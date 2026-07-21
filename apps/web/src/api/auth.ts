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

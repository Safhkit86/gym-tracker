import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from "@gym-tracker/shared";
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

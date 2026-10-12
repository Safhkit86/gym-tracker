import { SignJWT, jwtVerify } from "jose";

/** Proiezione pubblica di un utente: mai esposto il password hash. */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface RequestPasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ConfirmPasswordChangeRequest {
  otp: string;
}

/** Risposta generica (nessun dato sensibile) per forgot/reset/change password. */
export interface MessageResponse {
  message: string;
}

/** Risposta di register/login: token di accesso + utente pubblico. */
export interface AuthResponse {
  token: string;
  user: PublicUser;
}

/** Claim del JWT di accesso emesso da account-service. */
export interface AuthTokenClaims {
  /** id utente (subject) */
  sub: string;
  email: string;
}

/** Lanciata quando un access token e' assente/invalido/scaduto. */
export class TokenVerificationError extends Error {
  constructor(message = "Token non valido o scaduto.") {
    super(message);
    this.name = "TokenVerificationError";
  }
}

/**
 * Firma e verifica degli access token. Vive in shared perche' il formato del
 * token e' un contratto tra i servizi: account-service lo emette, tutti gli altri
 * lo verificano. Cosi' la logica (algoritmo, claim, scadenza) sta in un posto solo.
 */
export interface AccessTokenService {
  sign(claims: AuthTokenClaims): Promise<string>;
  verify(token: string): Promise<AuthTokenClaims>;
}

export function createAccessTokenService(
  secret: string,
  options: { expiresIn?: string } = {}
): AccessTokenService {
  const key = new TextEncoder().encode(secret);
  const expiresIn = options.expiresIn ?? "1h";

  return {
    async sign(claims: AuthTokenClaims): Promise<string> {
      return new SignJWT({ email: claims.email })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);
    },
    async verify(token: string): Promise<AuthTokenClaims> {
      try {
        const { payload } = await jwtVerify(token, key);
        if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
          throw new TokenVerificationError("Token privo dei claim richiesti.");
        }
        return { sub: payload.sub, email: payload.email };
      } catch (err) {
        if (err instanceof TokenVerificationError) {
          throw err;
        }
        throw new TokenVerificationError();
      }
    },
  };
}

// --- Sessione web via cookie httpOnly ---

/**
 * La webapp (a differenza dell'app mobile, che resta su Bearer + SecureStore)
 * non tiene piu' il JWT in localStorage (leggibile da un XSS, vedi CSP in
 * apps/web/nginx.conf per l'altra meta' della mitigazione): account-service
 * lo scrive anche in questo cookie httpOnly, invisibile a JS. Nessun
 * `Domain` esplicito nelle opzioni sotto: omesso, il browser lo scopa
 * all'origine della risposta COSI' COME LA VEDE LUI (il gateway, dato che
 * e' quello che il browser contatta — non l'hostname interno Docker di
 * account-service, che http-proxy-middleware non riscrive di default).
 */
export const AUTH_COOKIE_NAME = "gym_tracker_token";

/** `Secure`+`SameSite=None`: necessario perche' webapp e gateway restano
 *  origini diverse anche in locale (porte diverse) — un browser manda un
 *  cookie cross-origin via fetch solo con questa combinazione, e
 *  `SameSite=None` senza `Secure` viene ignorato dai browser moderni. Per
 *  questo api-gateway serve anche HTTPS (vedi infra/certs/README.md), non
 *  solo per la webapp: e' lui a scrivere la risposta col Set-Cookie che il
 *  browser deve accettare. */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/",
};

/** Stessa durata del JWT (default "1h" in createAccessTokenService): un
 *  cookie piu' longevo del token che contiene non avrebbe senso (il
 *  server lo rifiuterebbe comunque una volta scaduto). */
export const AUTH_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

interface RequestLike {
  header(name: string): string | undefined;
}

/** Legge un singolo cookie dall'header `Cookie` grezzo, senza la dipendenza
 *  `cookie-parser` (non serve: un solo cookie, formato semplice). */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    if (part.slice(0, separatorIndex).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separatorIndex + 1).trim());
      } catch {
        return null; // cookie malformato: trattato come assente, non un errore fatale.
      }
    }
  }
  return null;
}

/**
 * Estrae il token da "Authorization: Bearer <token>" (app mobile) o, se
 * assente, dal cookie httpOnly (webapp) — stessa funzione per entrambe,
 * usata da ogni `authenticate`/`requireAuth` di servizio/gateway cosi' la
 * logica di precedenza sta in un solo posto. Bearer ha sempre la
 * precedenza: un client che mandasse entrambi (non succede in pratica)
 * non deve dipendere ambiguamente dall'ordine.
 */
export function extractAuthToken(req: RequestLike): string | null {
  const [scheme, bearerToken] = (req.header("authorization") ?? "").split(" ");
  if (scheme === "Bearer" && bearerToken) {
    return bearerToken;
  }
  return readCookie(req.header("cookie"), AUTH_COOKIE_NAME);
}

interface ResponseLike {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options: Record<string, unknown>): unknown;
}

/** Scrive il cookie di sessione: va chiamato da account-service ad ogni
 *  emissione di un nuovo token (register/login/refresh), in aggiunta
 *  (non in sostituzione) al token nel body JSON che l'app mobile continua
 *  a usare come Bearer. */
export function setAuthCookie(res: ResponseLike, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, { ...AUTH_COOKIE_OPTIONS, maxAge: AUTH_COOKIE_MAX_AGE_MS });
}

/** Va chiamato da POST /auth/logout: un cookie httpOnly non e' leggibile/
 *  cancellabile da JS, quindi il "logout" lato client (rimuovere lo stato
 *  locale) da solo non basta a invalidarlo — senza questa rotta il cookie
 *  resterebbe valido (fino alla scadenza naturale di un'ora) anche dopo
 *  che l'utente ha premuto "Esci". */
export function clearAuthCookie(res: ResponseLike): void {
  res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
}

// --- Eventi RabbitMQ (account-service -> workout/history/progress/notify-service) ---

/**
 * Pubblicato da account-service dopo che l'utente ha cancellato il proprio
 * account (`DELETE /me`): i dati di account-service sono gia' stati
 * rimossi nella stessa richiesta HTTP — questo evento serve solo a far
 * rimuovere ai servizi a valle la propria quota di dati per-utente
 * (diritto all'oblio, GDPR). Best-effort come SessionLoggedEvent/
 * SessionDeletedEvent (vedi history.ts): un fallimento di publish non fa
 * fallire la richiesta HTTP (il dato primario in account-service e' comunque
 * rimosso), degrada solo la pulizia cross-service.
 *
 * Pubblicato su 4 code distinte (una per servizio consumatore) invece di
 * una sola: questo progetto non usa exchange fanout in nessun altro punto
 * (sempre 1 coda = 1 consumatore, vedi SESSION_LOGGED_QUEUE/
 * MEASUREMENT_SAVE_REQUESTED_QUEUE), quindi 4 code dedicate restano
 * coerenti con lo stile esistente invece di introdurre un pattern nuovo.
 */
export interface UserDeletedEvent {
  userId: string;
}

export const USER_DELETED_WORKOUT_QUEUE = "user-deleted-workout";
export const USER_DELETED_HISTORY_QUEUE = "user-deleted-history";
export const USER_DELETED_PROGRESS_QUEUE = "user-deleted-progress";
export const USER_DELETED_NOTIFY_QUEUE = "user-deleted-notify";

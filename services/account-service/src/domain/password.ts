import { hash, verify } from "@node-rs/argon2";

/**
 * Astrazione per l'hashing delle password, iniettabile per rendere i test
 * indipendenti dall'implementazione reale.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hashed: string, plain: string): Promise<boolean>;
}

/**
 * Implementazione con argon2id (raccomandazione OWASP).
 * @node-rs/argon2 usa binari precompilati (niente node-gyp): funziona in dev
 * Windows, in CI Linux e nell'immagine Docker alpine (musl).
 */
export const argon2Hasher: PasswordHasher = {
  hash(plain: string): Promise<string> {
    return hash(plain);
  },
  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      // Hash malformato o mismatch: trattato come credenziale non valida.
      return false;
    }
  },
};

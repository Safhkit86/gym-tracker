import { describe, it, expect } from "vitest";
import { argon2Hasher } from "../src/domain/password.js";

// Copre l'implementazione reale argon2id (i test di flusso usano un fake veloce).
describe("argon2Hasher", () => {
  it("verifica correttamente una password appena hashata", async () => {
    const hash = await argon2Hasher.hash("supersegreta");

    expect(hash).not.toBe("supersegreta");
    expect(await argon2Hasher.verify(hash, "supersegreta")).toBe(true);
  });

  it("rifiuta una password errata", async () => {
    const hash = await argon2Hasher.hash("supersegreta");

    expect(await argon2Hasher.verify(hash, "sbagliata")).toBe(false);
  });

  it("non lancia su un hash malformato", async () => {
    expect(await argon2Hasher.verify("non-un-hash", "qualcosa")).toBe(false);
  });
});

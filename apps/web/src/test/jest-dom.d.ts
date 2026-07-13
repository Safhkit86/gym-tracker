// @testing-library/jest-dom e' hoisted nel node_modules di root, condiviso col
// vitest@2 usato dai servizi backend: la sua augmentation "declare module
// 'vitest'" risolverebbe contro quel vitest, non contro il vitest@4 annidato
// qui in apps/web. Questo file vive dentro apps/web/src, quindi `import
// "vitest"` risolve correttamente contro la copia nested di questo workspace.
import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  // Interfacce senza membri propri: e' il pattern standard di augmentation
  // per estendere via declaration merging, non un errore di design.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}

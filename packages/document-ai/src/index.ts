/**
 * @bossnyumba/document-ai — public entrypoint.
 *
 * Composition surface for callers. Re-exports every subsystem and the
 * `createDocumentAI` factory that wires them together with sensible
 * defaults (mock OCR + no-op brain) so the package is safe to import
 * from any service without a runtime dependency on Anthropic.
 *
 * Subsystems are also reachable directly via subpath exports declared
 * in `package.json` (e.g. `@bossnyumba/document-ai/ocr`).
 */

export * from './types.js';
export * from './ocr/index.js';

/**
 * `@ts-nocheck` coverage allow-list.
 *
 * Files listed here are exempted from the mandatory no-`@ts-nocheck`
 * policy enforced by `scripts/audit-ts-nocheck-coverage.mjs`. Each
 * entry MUST justify why the directive is the correct contract.
 *
 * The DEFAULT POSITION is: no allowlist entries. `@ts-nocheck`
 * disables ALL TypeScript checking for the whole file, which makes
 * the file a production-blind region where latent type errors,
 * shape-drift bugs, and contract violations can hide indefinitely.
 *
 * Categories of legitimate exemption (rare):
 *   1. Generated code that the project regenerates from an external
 *      schema (e.g. OpenAPI, Protobuf) where editing the file is
 *      not the right correction surface.
 *   2. External library type shims when the upstream library has
 *      genuinely broken or absent `.d.ts` and the shim file is the
 *      only safe escape hatch (prefer a proper `.d.ts` shim over
 *      `@ts-nocheck` whenever possible).
 *   3. Migration scaffolds that exist for <30 days while a refactor
 *      lands. Such entries MUST include a removal-by date.
 *
 * Adding an entry is a type-safety decision. Reviewers MUST verify
 * the reason describes a real architectural exemption — never a
 * TODO or "we'll fix it later". If a file fights typecheck for
 * more than 10 minutes, leave the `@ts-nocheck` with an inline
 * `// FIXME(am3): <specific reason>` and link a tracking issue —
 * that path is for tracked debt, NOT this allowlist.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const TS_NOCHECK_ALLOWLIST = new Map([
  // (Seeded empty — the AM3 purge sweep aimed at zero. If a future
  //  rare legitimate case appears, add it here with a justifying
  //  reason in this same shape.)
]);

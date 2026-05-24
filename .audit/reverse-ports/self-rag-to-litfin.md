# Reverse Port — Self-RAG enforcer (BOSSNYUMBA → LITFIN)

**Direction**: BOSSNYUMBA `kernel/self-rag/self-rag.ts` → LITFIN brain
**Status**: BOSSNYUMBA implementation AHEAD of LITFIN (per `.audit/litfin-sota-2026-05-23/02-memory-rag-kg.md`)
**Recipient**: LITFIN engineering
**Date**: 2026-05-23

## Why this matters to LITFIN

LITFIN ships `faithfulness-monitor` and `cot-monitorability` but has **no first-class IsREL / IsSUP / IsUSE blocker** for hallucinated financial claims. Asai et al. (ICLR 2024, arXiv 2310.11511) introduced Self-RAG as a per-turn reflection-token gate; BOSSNYUMBA wired it as a *blocking* policy gate (not merely a monitor) in `packages/central-intelligence/src/kernel/self-rag/self-rag.ts`.

For a fintech runtime, the same pattern would close a "right-shape, wrong-number" class that even a 5-judge panel can miss when all judges share the same factual prior.

## Source artifact

```
BOSSNYUMBA101/packages/central-intelligence/src/kernel/self-rag/
  self-rag.ts        (enforcer; ~280 LOC, pure-function)
  __tests__/         (vitest, full branch coverage)
```

## Public surface

```ts
type SelfRagToken = 'high' | 'partial' | 'low' | 'unknown';

interface SelfRagVerdict {
  isRel: SelfRagToken;
  isSup: SelfRagToken;
  isUse: SelfRagToken;
  rationale: string;
  blocked: boolean;            // true when IsSUP is low/unknown on a financial claim
  blockedReason?: string;
}

interface SelfRagInput {
  userMessage: string;
  responseText: string;
  retrievedContext?: ReadonlyArray<string>;
}

function enforceSelfRag(
  input: SelfRagInput,
  judge: SelfRagJudge,                   // reuses existing kernel judge port
  policy?: SelfRagPolicy,                // override default thresholds
): Promise<SelfRagVerdict>;
```

The judge is the SAME Haiku-backed judge the kernel already wires for `req.requireJudge`. No new provider dependency.

## Integration point in LITFIN

Insert a call to `enforceSelfRag(...)` in the kernel's response path **after** the sensor returns the candidate response and **before** the policy gate / autonomy cap evaluation. On `blocked: true`, emit `RUN_ERROR` with `reason: 'self-rag/insufficient-support'` instead of returning the response.

Equivalent LITFIN file is likely `src/core/litfin-ai/kernel/think.ts` or wherever the sensor-response-then-gate ordering happens.

## Policy adaptation for LITFIN

LITFIN's zero-tolerance class is broader than BOSSNYUMBA's (rent numbers / unit IDs / lease terms). For finance, block IsSUP=`low|unknown` on any of:
- monetary amounts (any currency)
- account / IBAN / loan-ID references
- regulatory citations (SEC, FCA, IFRS, IAS rule numbers)
- credit-score or rating numerals
- date-of-record / payment-due / maturity dates

Centralize the pattern detection in a `containsFinancialClaim(text): boolean` helper (BOSSNYUMBA's analog is `containsContractualClaim`).

## Why a port (vs re-implementation)

The pure-function shape + judge-port DI means **zero LITFIN runtime coupling**. Copy the file, swap the `SelfRagJudge` implementation to call LITFIN's existing judge plumbing, swap the financial-claim detector, and ship behind a feature flag. Anthropic-style.

## Estimated effort

- Code port + adaptation: 0.5 day
- LITFIN-specific financial-claim detector + tests: 0.5 day
- Kernel wire-in + behind a feature flag: 0.25 day
- Eval harness: replay 200 historical finance turns, measure block precision/recall: 1 day

**Total: ~2.25 days.**

## Eval expectations

If LITFIN's existing faithfulness-monitor is true-negative-heavy and false-positive-light, Self-RAG will add ~3-7% extra blocks of which 70-85% will be true positives on financial-claim-without-context. The remainder are conservative refusals — review whether to relax the IsSUP threshold from `low` to `low|partial` after 2 weeks of production data.

## Citations

- Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection," ICLR 2024 (arXiv:2310.11511)
- BOSSNYUMBA progressive intelligence policy `2025-progressive-intelligence.md` §5 (zero-tolerance for hallucinated rent/unit/lease numbers)
- BOSSNYUMBA enforcer: `packages/central-intelligence/src/kernel/self-rag/self-rag.ts`

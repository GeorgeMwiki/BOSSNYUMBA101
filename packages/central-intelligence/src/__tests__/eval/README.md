# Nyumba Mind kernel — regression eval harness

A scenario-level regression suite for the BossNyumba Nyumba Mind
kernel. The unit tests next to this folder prove specific code paths
work; this harness drives a curated corpus of realistic user requests
through `composeSovereign()` end-to-end and tracks aggregate metrics
(mean confidence, drift rate, refusal rate, p95 latency, gate
verdicts) so that a regression — e.g. a policy gate change that
starts refusing too much — surfaces as a CI failure.

The harness is fully deterministic and CI-runnable: no external
services, no real Anthropic calls, no Postgres. Stub sensors return
canned text; in-memory sinks record drift / cot / provenance.

## Layout

```
__tests__/eval/
  scenarios.ts     # corpus — typed, curated input scenarios
  runner.ts        # runEvalScenario / runEvalSuite + aggregate summary
  baseline.json    # checked-in metrics from the latest passing run
  eval.test.ts     # vitest entry point — runs corpus + diffs baseline
  README.md
```

## How it works

Each scenario carries:

- a `ThoughtRequest` (the question the kernel sees),
- a `stubResponse` (what the stub sensor returns), and
- an `expected` clause (decision kind, gate verdicts, text content,
  confidence floor, drift event count).

`runEvalScenario(scenario)` builds a fresh `composeSovereign()` with
the stub sensor and in-memory sinks, calls `kernel.think(request)`,
then runs every assertion in `expected.*` and captures metrics into an
`EvalResult`. `runEvalSuite(corpus)` is a serial loop over the corpus
that produces an `EvalSummary` of aggregate metrics.

The vitest entry point (`eval.test.ts`) does two things:

1. Asserts every scenario passes its individual `expected.*` clauses.
2. Compares the live summary to `baseline.json` and fails when any
   threshold is exceeded.

## Adding a scenario

Open `scenarios.ts`, copy any existing entry, change:

- `id` — stable, dot-separated, do NOT renumber once shipped.
- `description` — one line of intent.
- `category` — one of `tenant | owner | estate | hq | refusal | drift
  | policy | confidence | multilang`.
- `request` — the `ThoughtRequest` to drive through the kernel.
- `stubResponse.text` — exactly what the stub sensor returns.
- `expected` — the assertions the runner enforces:

  | Field                  | Meaning                                                                 |
  | ---------------------- | ----------------------------------------------------------------------- |
  | `kind`                 | `'answer' \| 'softened' \| 'refusal'` — the decision shape we expect    |
  | `minConfidence`        | overall-confidence floor (only on non-refusal)                          |
  | `maxLatencyMs`         | wall-clock budget for `kernel.think()`                                  |
  | `mustContain`          | every string here must appear in the redacted output                    |
  | `mustNotContain`       | none of these may appear in the output                                  |
  | `expectedGate`         | `'inviolable' \| 'drift' \| 'policy'` — which gate we expect to act     |
  | `expectedDriftCount`   | minimum drift events recorded during the turn                           |

Append the new scenario into the appropriate category array at the
bottom of `scenarios.ts`. Re-run the suite (see below); when it
passes, refresh the baseline.

## Refreshing the baseline

After a deliberate kernel change you expect to shift the aggregate
numbers, regenerate the baseline:

```bash
EVAL_WRITE_BASELINE=1 pnpm -C packages/central-intelligence test
```

This writes `baseline.next.json` next to `baseline.json`. Diff the
two; when satisfied, `mv baseline.next.json baseline.json` and
commit.

To skip the baseline diff for a run (e.g. on a fresh clone before
the baseline has stabilised):

```bash
EVAL_NO_BASELINE=1 pnpm -C packages/central-intelligence test
```

If `baseline.json` does not yet exist (first run on a fresh clone),
the harness writes it automatically and does not assert against it
that turn.

## Regression thresholds

The thresholds the suite enforces (live in `eval.test.ts`):

| Metric              | Bound                                  |
| ------------------- | -------------------------------------- |
| `meanConfidence`    | may not drop by more than `0.05`       |
| `refusalRate`       | may not move by more than `0.10`       |
| `driftRate`         | may not move by more than `0.10`       |
| `p95LatencyMs`      | may not rise above `2x` baseline       |

These are intentionally slack while the harness matures. Tighten them
once the corpus and the kernel both stabilise.

## Running

The harness is a single vitest file and is included in the package's
default test run:

```bash
pnpm -C packages/central-intelligence test
```

Filter to just the eval test:

```bash
pnpm -C packages/central-intelligence test src/__tests__/eval/eval.test.ts
```

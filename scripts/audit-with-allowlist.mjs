#!/usr/bin/env node
/**
 * Wrapper around `pnpm audit --json` that allows a documented allowlist
 * of accepted-risk advisories. Exits 0 only when EVERY high+ advisory
 * is in the allowlist; otherwise exits 1 with a structured failure
 * report so operators can see exactly which advisory needs action.
 *
 * Usage: node scripts/audit-with-allowlist.mjs
 *
 * The allowlist below covers two categories:
 *   1. Unfixable: the upstream patched version does not exist on npm
 *      (e.g. lodash >=4.18.0 — latest published is 4.17.21).
 *   2. Major-version breaking change deferred to its own PR
 *      (e.g. drizzle-orm 0.36 → 0.45).
 *
 * Each entry includes `reason`, `tracked_in`, and `next_review` so the
 * accept-decision is auditable. The CI fails fast if a NEW advisory
 * appears outside the allowlist.
 */

import { execSync } from 'node:child_process';

const ALLOWLIST = [
  {
    package: 'lodash',
    severity: ['high', 'moderate'],
    fix: '>=4.18.0',
    reason:
      'lodash patched version >=4.18.0 does not exist on npm (latest is 4.17.21). The vulnerabilities are in `_.template` (code injection) and `_.unset` array-path (prototype pollution). Codebase audit confirmed no `_.template` calls accept untrusted input. Migration to lodash-es or per-function imports is tracked separately.',
    tracked_in: 'Docs/DEP_HYGIENE.md (lodash migration)',
    next_review: '2026-Q3',
  },
  {
    package: 'drizzle-orm',
    severity: ['high'],
    fix: '>=0.45.2',
    reason:
      'drizzle-orm 0.36 → 0.45 is a major version upgrade with breaking schema-builder changes (override pinned at 0.36.4 for the wave-1 schemas). The SQL-injection-via-improperly-escaped-identifiers fix only applies when callers pass tenant-controlled identifier strings into raw SQL — codebase audit confirmed all our calls use Drizzle\'s typed builders, not raw identifier interpolation.',
    tracked_in: 'Docs/DEP_HYGIENE.md (drizzle-orm 0.45 migration)',
    next_review: '2026-Q2',
  },
  {
    package: '@opentelemetry/auto-instrumentations-node',
    severity: ['high'],
    fix: '>=0.75.0',
    reason:
      'GHSA-q7rr-3cgh-j5r3: Prometheus exporter process crash via malformed HTTP request. The vulnerable surface is the Prometheus /metrics scrape endpoint. In BOSSNYUMBA the Prometheus exporter is not exposed publicly — only the cluster-internal Grafana scraper hits /metrics behind ingress-level auth. A malformed request would have to come from inside the cluster, so the crash vector is not reachable from the public network. Bumping to >=0.75.0 is a major version that touches the auto-instrumentation surface and is scheduled into the wave-L OpenTelemetry upgrade. Accepting the risk for now.',
    tracked_in: 'Docs/DEP_HYGIENE.md (OpenTelemetry wave-L upgrade)',
    next_review: '2026-Q3',
  },
  {
    package: '@opentelemetry/sdk-node',
    severity: ['high'],
    fix: '>=0.217.0',
    reason:
      'GHSA-q7rr-3cgh-j5r3: Same advisory as @opentelemetry/auto-instrumentations-node — Prometheus exporter process crash via malformed HTTP request. Same mitigation (cluster-internal scrape only). Bumping to >=0.217.0 is a coordinated upgrade with auto-instrumentations-node, tracked in the wave-L plan.',
    tracked_in: 'Docs/DEP_HYGIENE.md (OpenTelemetry wave-L upgrade)',
    next_review: '2026-Q3',
  },
  {
    package: 'vega',
    severity: ['high'],
    fix: '>=6.2.0',
    reason:
      'GHSA-7f2v-3qq3-vvjf: Vega XSS via expressions abusing toString calls in environments using the VEGA_DEBUG global variable. BOSSNYUMBA never sets VEGA_DEBUG in production; the C3 generative-UI pipeline emits server-validated Vega-Lite specs that ajv-check before render, and the LLM never reaches the expression-builder surface. vega 6.x is a major version with a different rendering pipeline; sticking with 5.x until upstream lands a 5.x backport or we plan the 6.x migration.',
    tracked_in: 'Docs/DEP_HYGIENE.md (vega 6.x migration)',
    next_review: '2026-Q3',
  },
  {
    package: 'vega-expression',
    severity: ['high'],
    fix: '>=5.2.1',
    reason:
      'GHSA-7f2v-3qq3-vvjf: Same advisory as vega — XSS via expressions abusing toString with VEGA_DEBUG. Same mitigation: VEGA_DEBUG never set in production; LLM never reaches expression surface (server-emitted, ajv-validated specs only).',
    tracked_in: 'Docs/DEP_HYGIENE.md (vega 6.x migration)',
    next_review: '2026-Q3',
  },
  {
    package: 'vega-functions',
    severity: ['high'],
    fix: '>=6.1.1',
    reason:
      'GHSA-m9rg-mr6g-75gm: vega-functions XSS via setdata function. The C3 generative-UI pipeline server-emits Vega-Lite specs that ajv-validate against the v5 JSON schema BEFORE render. The LLM never reaches client-side setdata — setdata is invoked only by the Vega runtime against server-controlled data payloads. setdata-XSS requires attacker-controlled data injection into a setdata call site, which doesn\'t exist in our pipeline.',
    tracked_in: 'Docs/DEP_HYGIENE.md (vega 6.x migration)',
    next_review: '2026-Q3',
  },
];

function isAllowlisted(advisory) {
  for (const entry of ALLOWLIST) {
    if (
      advisory.module_name === entry.package &&
      entry.severity.includes(advisory.severity) &&
      (advisory.patched_versions === entry.fix ||
        (advisory.fixed_in || '') === entry.fix)
    ) {
      return entry;
    }
  }
  return null;
}

let auditOutput;
try {
  auditOutput = execSync('pnpm audit --json', {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
} catch (err) {
  // pnpm audit exits non-zero when there are advisories — that's
  // expected. We parse stdout regardless.
  auditOutput = err.stdout?.toString() || '';
}

let data;
try {
  data = JSON.parse(auditOutput);
} catch {
  console.error('Failed to parse pnpm audit output as JSON');
  console.error(auditOutput.slice(0, 500));
  process.exit(2);
}

const advisories = Object.values(data.advisories ?? {});
const counts = data.metadata?.vulnerabilities ?? {};
const totalBlocking = (counts.high ?? 0) + (counts.critical ?? 0);

console.log('## pnpm audit summary');
console.log(JSON.stringify(counts, null, 2));
console.log();

const seen = new Set();
const blocking = [];
const accepted = [];
for (const adv of advisories) {
  const sev = adv.severity;
  if (sev !== 'high' && sev !== 'critical') continue;
  const key = `${adv.module_name}|${sev}|${adv.patched_versions || adv.fixed_in || ''}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const allowed = isAllowlisted(adv);
  if (allowed) accepted.push({ adv, entry: allowed });
  else blocking.push(adv);
}

if (accepted.length > 0) {
  console.log('## Accepted (allowlisted) high+ advisories');
  for (const { adv, entry } of accepted) {
    console.log(
      `  - ${adv.severity.toUpperCase()} ${adv.module_name} (fix ${entry.fix}): ${entry.reason.slice(0, 100)}…`,
    );
    console.log(`    Tracked in: ${entry.tracked_in}`);
    console.log(`    Next review: ${entry.next_review}`);
  }
  console.log();
}

if (blocking.length > 0) {
  console.log('## ❌ BLOCKING high+ advisories (not in allowlist)');
  for (const adv of blocking) {
    console.log(
      `  - ${adv.severity.toUpperCase()} ${adv.module_name}: ${adv.title}`,
    );
    console.log(
      `    Vulnerable: ${adv.vulnerable_versions}  → fix: ${adv.patched_versions || adv.fixed_in}`,
    );
    console.log(`    Advisory: ${adv.url || adv.references || ''}`);
  }
  process.exit(1);
}

console.log(
  `✅ All high+ advisories are allowlisted (${accepted.length} accepted, 0 blocking).`,
);
console.log(
  `   Moderate: ${counts.moderate ?? 0}, Low: ${counts.low ?? 0} — informational.`,
);
process.exit(0);

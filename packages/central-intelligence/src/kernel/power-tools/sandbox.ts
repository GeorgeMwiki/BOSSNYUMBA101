/**
 * power_tool.sandbox — pure JS evaluation in a frozen sandbox.
 *
 * Wraps the future js-sandbox primitive (F7). Until F7 lands, the
 * executor is a stub that refuses with `NOT_IMPLEMENTED` so callers
 * learn the capability isn't wired yet. When F7 lands the api-gateway
 * composition root will pass a real `JsSandboxAdapter` via deps and
 * `execute` will route through it.
 *
 * Why this is a power-tool rather than an HQ-tier tool:
 *   The sandbox is a meta-capability the agent uses on ITSELF — it's
 *   the agent computing a derived value rather than reading or
 *   mutating a domain entity. HQ-tier tools are identity-scoped
 *   domain actions; this sits one level up alongside compose +
 *   schedule + self-modification.
 *
 * Tier model:
 *   - requiredTier: owner-advisor (residents do not need an eval surface;
 *                    the eval may leak partial state through error
 *                    messages, so we keep it out of resident-tier
 *                    inventories)
 *
 * Approval: none. The sandbox cannot reach the network, filesystem, or
 * any host capability. Pure computation only.
 *
 * Audit trail: every run lands in `audit_events` with code + duration
 * for debugging and "what has the brain been computing?" forensics.
 *
 * @module kernel/power-tools/sandbox
 */

import { z } from 'zod';
import type {
  PowerTool,
  PowerToolContext,
  PowerToolResult,
} from './types.js';

const MAX_TIMEOUT_MS = 5000;
const DEFAULT_TIMEOUT_MS = 1000;
const MAX_CODE_BYTES = 8 * 1024; // 8 KB cap on snippet size

// ─────────────────────────────────────────────────────────────────────
// Adapter port — the future js-sandbox primitive plugs in here.
// ─────────────────────────────────────────────────────────────────────

export interface JsSandboxRunOutcome {
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: string;
  readonly durationMs: number;
}

export interface JsSandboxAdapter {
  run(code: string, timeoutMs: number): Promise<JsSandboxRunOutcome>;
}

// ─────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────

export const SandboxSchema = z.object({
  code: z.string().min(1).max(MAX_CODE_BYTES),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(MAX_TIMEOUT_MS)
    .optional(),
});

export type SandboxArgs = z.infer<typeof SandboxSchema>;

export interface SandboxOutput {
  readonly action: 'sandbox';
  readonly value: unknown;
  readonly durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// Factory — composition root supplies the adapter; tests inject stubs.
// ─────────────────────────────────────────────────────────────────────

export function createSandboxPowerTool(
  adapter: JsSandboxAdapter | null,
): PowerTool<SandboxArgs, SandboxOutput> {
  return {
    id: 'sandbox',
    name: 'JS sandbox eval',
    description:
      'Evaluate a small pure JavaScript snippet for ad-hoc calculations. No require, no fs, no network — frozen empty context.',
    requiredTier: 'owner-advisor',
    requiresApproval: false,
    auditDestination: 'audit-events',
    schema: SandboxSchema,
    async execute(
      _ctx: PowerToolContext,
      args: SandboxArgs,
    ): Promise<PowerToolResult<SandboxOutput>> {
      if (!adapter) {
        return {
          kind: 'refused',
          reasonCode: 'NOT_IMPLEMENTED',
          message:
            'js-sandbox adapter is not wired in this composition (F7 stub). Bind a JsSandboxAdapter at the api-gateway composition root.',
        };
      }
      const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const outcome = await adapter.run(args.code, timeoutMs);
      if (!outcome.ok) {
        return {
          kind: 'failed',
          message: outcome.error ?? 'sandbox execution failed',
        };
      }
      return {
        kind: 'ok',
        output: {
          action: 'sandbox',
          value: outcome.value ?? null,
          durationMs: outcome.durationMs,
        },
      };
    },
  };
}

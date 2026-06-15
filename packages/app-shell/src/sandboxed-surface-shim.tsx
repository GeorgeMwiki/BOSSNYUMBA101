'use client';

/**
 * PORT-SHIM: `@bossnyumba/genui` lacks `SandboxedSurface` /
 * `SandboxedSurfaceFrame` / `parseSandboxedSurface`; local stubs for
 * build-green, reconcile at live-wiring.
 *
 * The sibling repo this package was ported from shipped a CSP-isolated
 * "sandboxed surface" renderer in `@bossnyumba/genui` for genuinely novel
 * MD-authored surfaces the typed catalogs can't express. BossNyumba's `genui`
 * has drifted and exports only the AG-UI primitive catalog (no iframe surface
 * renderer). This module provides the minimal, honest local equivalent so
 * `app-shell` builds dark; when genui regains a sandboxed-surface renderer,
 * swap these imports back to `@bossnyumba/genui` and delete this file.
 *
 * Security posture is preserved verbatim from the sibling contract:
 *   - the iframe `sandbox` attr ALWAYS starts with `allow-scripts` and NEVER
 *     contains `allow-same-origin` (an isolated origin is the whole point);
 *   - `srcdoc` is rendered, not a same-origin URL;
 *   - `postMessage` events are dropped unless their `origin` is in the
 *     surface's `allowedMessageOrigins` allowlist.
 */

import * as React from 'react';

// ── Type ────────────────────────────────────────────────────────────────────

export interface SandboxedSurface {
  readonly id: string;
  readonly version: number;
  readonly tenantId: string;
  readonly surfaceKey: string;
  readonly title: string;
  readonly description: string;
  /** Opaque body discriminator carried from the generator (e.g. `'srcdoc'`). */
  readonly body: string;
  /** The full document rendered into the isolated iframe via `srcdoc`. */
  readonly srcdoc: string;
  /**
   * Extra sandbox tokens to grant ON TOP of the implicit `allow-scripts`.
   * `allow-same-origin` is rejected by the parser — it defeats isolation.
   */
  readonly sandboxTokens: readonly string[];
  readonly csp: string;
  readonly allowedMessageOrigins: readonly string[];
  readonly heightPx: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Parser (hand-rolled; app-shell carries no zod dependency) ────────────────

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new Error('SandboxedSurface: expected an object');
  }
  return input as Record<string, unknown>;
}

function reqString(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`SandboxedSurface: field "${key}" must be a non-empty string`);
  }
  return v;
}

function reqNumber(rec: Record<string, unknown>, key: string): number {
  const v = rec[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`SandboxedSurface: field "${key}" must be a finite number`);
  }
  return v;
}

function reqStringArray(rec: Record<string, unknown>, key: string): readonly string[] {
  const v = rec[key];
  if (!Array.isArray(v) || v.some((item) => typeof item !== 'string')) {
    throw new Error(`SandboxedSurface: field "${key}" must be a string[]`);
  }
  return v as readonly string[];
}

/**
 * Validates and freezes a `SandboxedSurface`. Throws on a malformed input or a
 * security-defeating sandbox token. Mirrors the sibling `parseSandboxedSurface`
 * contract closely enough for build-green and the app-shell test fixtures.
 */
export function parseSandboxedSurface(input: unknown): SandboxedSurface {
  const rec = asRecord(input);
  const sandboxTokens = reqStringArray(rec, 'sandboxTokens');
  if (sandboxTokens.includes('allow-same-origin')) {
    throw new Error(
      'SandboxedSurface: "allow-same-origin" is forbidden — it defeats iframe isolation',
    );
  }
  return Object.freeze({
    id: reqString(rec, 'id'),
    version: reqNumber(rec, 'version'),
    tenantId: reqString(rec, 'tenantId'),
    surfaceKey: reqString(rec, 'surfaceKey'),
    title: reqString(rec, 'title'),
    description: reqString(rec, 'description'),
    body: reqString(rec, 'body'),
    srcdoc: reqString(rec, 'srcdoc'),
    sandboxTokens,
    csp: reqString(rec, 'csp'),
    allowedMessageOrigins: reqStringArray(rec, 'allowedMessageOrigins'),
    heightPx: reqNumber(rec, 'heightPx'),
    createdBy: reqString(rec, 'createdBy'),
    createdAt: reqString(rec, 'createdAt'),
    updatedAt: reqString(rec, 'updatedAt'),
  });
}

// ── Hardened frame ───────────────────────────────────────────────────────────

export interface SandboxedSurfaceFrameProps {
  readonly surface: SandboxedSurface;
  /** Host handler for postMessages whose origin is in the allowlist. */
  readonly onMessage?: (data: unknown, origin: string) => void;
}

/**
 * Builds the `sandbox` attribute: implicit `allow-scripts` first, then any
 * extra vetted tokens, de-duplicated, with `allow-same-origin` defensively
 * stripped (the parser already rejects it).
 */
function buildSandboxAttr(tokens: readonly string[]): string {
  const merged = ['allow-scripts', ...tokens].filter(
    (token) => token !== 'allow-same-origin',
  );
  return Array.from(new Set(merged)).join(' ');
}

export const SandboxedSurfaceFrame: React.FC<SandboxedSurfaceFrameProps> = ({
  surface,
  onMessage,
}) => {
  React.useEffect(() => {
    if (!onMessage) return undefined;
    const allowed = new Set(surface.allowedMessageOrigins);
    const handler = (event: MessageEvent): void => {
      if (!allowed.has(event.origin)) return;
      onMessage(event.data, event.origin);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage, surface.allowedMessageOrigins]);

  return (
    <iframe
      data-testid="sandboxed-surface-frame"
      title={surface.title}
      sandbox={buildSandboxAttr(surface.sandboxTokens)}
      srcDoc={surface.srcdoc}
      height={surface.heightPx}
      style={{ width: '100%', border: 'none' }}
      referrerPolicy="no-referrer"
    />
  );
};

SandboxedSurfaceFrame.displayName = 'SandboxedSurfaceFrame';

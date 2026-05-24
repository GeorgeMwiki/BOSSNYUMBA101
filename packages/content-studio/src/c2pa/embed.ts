/**
 * C2PA manifest embedding.
 *
 * Two strategies:
 *
 *   1. SIDECAR (default, always available) — write the manifest as a
 *      `.c2pa.json` file alongside the asset. C2PA spec §10.2 explicitly
 *      sanctions sidecar manifests for formats that don't support
 *      embedded XMP/JUMBF.
 *
 *   2. EMBEDDED (opt-in, requires `c2pa-node`) — write the JUMBF box
 *      into the asset's container (JPEG APP11, PNG ancillary, MP4 box).
 *      Loaded via a Function() dynamic import so the package builds
 *      without `c2pa-node` installed.
 *
 * Pure orchestration. Returns the BYTES (sidecar or modified asset) —
 * the caller chooses where to persist (file system, S3, blob store).
 */

import type { C2paManifest } from '../types.js';
import { canonicalize } from './signer.js';

export type EmbedStrategy = 'sidecar' | 'embedded';

export interface EmbedRequest {
  readonly asset: Uint8Array;
  readonly assetMime: string; // e.g. 'image/jpeg'
  readonly manifest: C2paManifest;
  readonly strategy?: EmbedStrategy;
}

export interface EmbedResult {
  readonly strategy: EmbedStrategy;
  /** The asset bytes — modified when embedded, unchanged when sidecar. */
  readonly assetBytes: Uint8Array;
  /** Non-null when sidecar: the bytes of the `.c2pa.json` sidecar. */
  readonly sidecarBytes: Uint8Array | null;
  /** Suggested sidecar filename suffix (e.g. `.c2pa.json`). */
  readonly sidecarSuffix: string | null;
}

const TEXT_ENCODER = new TextEncoder();

export async function embedManifest(req: EmbedRequest): Promise<EmbedResult> {
  const strategy: EmbedStrategy = req.strategy ?? 'sidecar';

  if (strategy === 'sidecar') {
    const sidecarBytes = TEXT_ENCODER.encode(canonicalize(req.manifest));
    return {
      strategy: 'sidecar',
      assetBytes: req.asset,
      sidecarBytes,
      sidecarSuffix: '.c2pa.json',
    };
  }

  // Embedded — try the optional c2pa-node module. If unavailable, fall
  // back to sidecar with a warning (callers can detect via the
  // returned `strategy` field).
  try {
    const dynamicImport = new Function(
      'specifier',
      'return import(specifier);',
    ) as (specifier: string) => Promise<unknown>;
    const mod = (await dynamicImport('c2pa-node')) as
      | { embed?: (asset: Uint8Array, manifestJson: string, mime: string) => Promise<Uint8Array> }
      | undefined;
    if (mod?.embed) {
      const modified = await mod.embed(req.asset, canonicalize(req.manifest), req.assetMime);
      return {
        strategy: 'embedded',
        assetBytes: modified,
        sidecarBytes: null,
        sidecarSuffix: null,
      };
    }
  } catch {
    // c2pa-node not installed or threw — silently fall back.
  }

  // Fallback: sidecar with the strategy field flipped back so callers know.
  const sidecarBytes = TEXT_ENCODER.encode(canonicalize(req.manifest));
  return {
    strategy: 'sidecar',
    assetBytes: req.asset,
    sidecarBytes,
    sidecarSuffix: '.c2pa.json',
  };
}

/**
 * Extract a manifest from an asset + optional sidecar. Returns null
 * when no manifest is found.
 */
export function extractSidecarManifest(sidecarBytes: Uint8Array): C2paManifest | null {
  try {
    const text = new TextDecoder().decode(sidecarBytes);
    const parsed = JSON.parse(text) as C2paManifest;
    if (!parsed || typeof parsed !== 'object' || !('claimGenerator' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

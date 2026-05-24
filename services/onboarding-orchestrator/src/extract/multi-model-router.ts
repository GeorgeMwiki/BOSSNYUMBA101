/**
 * Multi-model document/voice extraction router.
 *
 * Research §3 (Document & file extraction) — TokenMix unified router
 * pattern, 40-60% cost reduction by routing each artifact to the
 * cheapest model that hits the accuracy bar.
 *
 *   * clean PDF       → Gemini Flash (free tier) / Pro (paid)
 *   * complex layout  → Claude Sonnet (97.6% accuracy)
 *   * scanned receipt → GPT-4o Vision (97.3% OCR)
 *   * Excel ledger    → LlamaParse (XLSX → JSON)
 *   * voice (Sw/Lug)  → Lelapa Vulavula
 *   * voice (other)   → ElevenLabs / Whisper fallback
 *
 * This file ships:
 *   1. The router (pure function `routeArtifact` → ModelChoice).
 *   2. An `ExtractClient` interface — composition root injects the
 *      real adapters (HTTP calls go through @bossnyumba/ai-copilot's
 *      multi-llm-synthesizer in production).
 *   3. A no-op `NullExtractClient` for tests.
 *
 * We do NOT call any external API here — that's the composition
 * root's job. Pure routing decisions stay testable.
 */

export type ArtifactKind = 'pdf_clean' | 'pdf_complex' | 'image_scanned' | 'image_photo' | 'excel' | 'voice' | 'text';

export type ModelChoice =
  | { provider: 'gemini'; tier: 'flash' | 'pro' }
  | { provider: 'claude'; tier: 'sonnet' | 'opus' }
  | { provider: 'gpt4o'; tier: 'vision' | 'transcribe' }
  | { provider: 'llamaparse'; tier: 'default' }
  | { provider: 'lelapa'; tier: 'vulavula' }
  | { provider: 'elevenlabs'; tier: 'scribe' };

export interface RouteContext {
  readonly artifactKind: ArtifactKind;
  /** Tenant tier — 'free' biases hard toward Gemini Flash for cost. */
  readonly tier: 'free' | 'paid' | 'enterprise';
  /** BCP-47 locale; bumps Lelapa for sw-KE / lg-UG / ha-NG voice. */
  readonly locale: string;
  /** Optional MIME hint when artifactKind is ambiguous. */
  readonly mimeType?: string;
}

/**
 * Pure routing decision — no I/O. Used by the Extractor agent BEFORE
 * any network call so we can log + dry-run.
 */
export function routeArtifact(ctx: RouteContext): ModelChoice {
  // Voice — locale-aware Africa-first.
  if (ctx.artifactKind === 'voice') {
    if (ctx.locale.startsWith('sw') || ctx.locale.startsWith('lg') || ctx.locale.startsWith('ha')) {
      return { provider: 'lelapa', tier: 'vulavula' };
    }
    return { provider: 'elevenlabs', tier: 'scribe' };
  }

  // Excel — LlamaParse is the only one that emits clean XLSX → JSON.
  if (ctx.artifactKind === 'excel') {
    return { provider: 'llamaparse', tier: 'default' };
  }

  // Scanned / photographed receipts — GPT-4o vision wins on OCR.
  if (ctx.artifactKind === 'image_scanned') {
    return { provider: 'gpt4o', tier: 'vision' };
  }

  // Free-tier clean PDF — Gemini Flash, the cheapest path.
  if (ctx.artifactKind === 'pdf_clean') {
    return ctx.tier === 'free'
      ? { provider: 'gemini', tier: 'flash' }
      : { provider: 'gemini', tier: 'pro' };
  }

  // Complex layouts — Claude Sonnet.
  if (ctx.artifactKind === 'pdf_complex') {
    return { provider: 'claude', tier: 'sonnet' };
  }

  // Photo of unit / whiteboard — Claude Sonnet multimodal.
  if (ctx.artifactKind === 'image_photo') {
    return { provider: 'claude', tier: 'sonnet' };
  }

  // Plain text — Gemini Flash by default (cheap classification).
  return { provider: 'gemini', tier: 'flash' };
}

/**
 * Detect artifact kind from MIME + a few bytes. Heuristic — good
 * enough for routing, not for content trust.
 */
export function detectArtifactKind(mimeType: string | undefined, fileName: string | undefined): ArtifactKind {
  const lower = (mimeType ?? '').toLowerCase();
  const name = (fileName ?? '').toLowerCase();

  if (lower.startsWith('audio/') || name.endsWith('.ogg') || name.endsWith('.mp3') || name.endsWith('.opus') || name.endsWith('.m4a')) {
    return 'voice';
  }
  if (lower.includes('spreadsheet') || lower.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return 'excel';
  }
  if (lower === 'application/pdf' || name.endsWith('.pdf')) {
    // Heuristic: PDFs with "scan" in the name are usually photographed.
    return name.includes('scan') ? 'image_scanned' : 'pdf_clean';
  }
  if (lower.startsWith('image/') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.heic')) {
    return name.includes('receipt') || name.includes('scan') ? 'image_scanned' : 'image_photo';
  }
  return 'text';
}

// ---------------------------------------------------------------------------
// Client interface — adapters injected by composition root.
// ---------------------------------------------------------------------------

export interface ExtractRequest {
  readonly sessionId: string;
  readonly artifactKind: ArtifactKind;
  readonly fileHandle?: string;
  readonly text?: string;
  readonly locale: string;
  readonly hint?: string;
}

export interface ExtractResult {
  readonly ok: boolean;
  readonly model: ModelChoice;
  readonly slots: Record<string, unknown>;
  readonly rawText?: string;
  readonly error?: string;
}

export interface ExtractClient {
  extract(req: ExtractRequest, route: ModelChoice): Promise<ExtractResult>;
}

/** No-op client for tests — echoes nothing, never fails. */
export class NullExtractClient implements ExtractClient {
  async extract(req: ExtractRequest, route: ModelChoice): Promise<ExtractResult> {
    return { ok: true, model: route, slots: {} };
  }
}

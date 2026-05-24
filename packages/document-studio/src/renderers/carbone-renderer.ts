/**
 * Carbone renderer.
 *
 * Carbone is the OSS template engine recommended by the research
 * report — one DOCX/ODT/HTML/XLSX template renders to any of
 * PDF/DOCX/XLSX/PPTX/ODS/HTML/CSV. The real implementation POSTs to
 * a self-hosted Carbone container; the URL comes from `CARBONE_URL`.
 *
 * For tests and offline development the renderer falls back to a
 * deterministic stub that produces a small placeholder buffer whose
 * content encodes the template reference + the input data hash. The
 * stub is byte-stable so audit hashes can be asserted exactly.
 *
 * Refs:
 *   - https://carbone.io/api-reference.html
 *   - .audit/litfin-sota-2026-05-23/19-document-generation.md §5
 */

import { createHash } from 'node:crypto';
import {
  MIME_TYPES,
  type DocFormat,
  type Renderer,
  type RendererInput,
  type RendererOutput,
} from '../types.js';

export interface CarboneRendererOptions {
  /** Self-hosted Carbone URL, e.g. `http://carbone:4000`. Stub-mode if unset. */
  readonly carboneUrl?: string;
  /** Optional bearer token forwarded as `Authorization: Bearer …`. */
  readonly apiToken?: string;
  /** Per-request timeout for the remote render. Defaults to 15s. */
  readonly timeoutMs?: number;
  /**
   * Injection seam for tests — lets the suite assert request shape
   * without hitting fetch. Defaults to the global `fetch`.
   */
  readonly fetchImpl?: typeof fetch;
}

export class CarboneRenderer implements Renderer {
  public readonly id = 'carbone';
  private readonly options: CarboneRendererOptions;

  constructor(options: CarboneRendererOptions = {}) {
    this.options = options;
  }

  /** True when no remote URL is configured — falls back to deterministic stub. */
  public isStub(): boolean {
    return !this.options.carboneUrl;
  }

  async render<TData>(input: RendererInput<TData>): Promise<RendererOutput> {
    if (this.isStub()) {
      return stubRender(this.id, input);
    }
    return this.remoteRender(input);
  }

  private async remoteRender<TData>(
    input: RendererInput<TData>,
  ): Promise<RendererOutput> {
    const url = `${this.options.carboneUrl}/render/${encodeURIComponent(input.templateRef)}`;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 15_000,
    );

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: MIME_TYPES[input.format],
      };
      if (this.options.apiToken) {
        headers['authorization'] = `Bearer ${this.options.apiToken}`;
      }

      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: input.data,
          convertTo: input.format,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Carbone render failed: ${response.status} ${response.statusText}`,
        );
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      return {
        buffer,
        mimeType: MIME_TYPES[input.format],
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Deterministic placeholder buffer. Encodes `STUB:<rendererId>:<format>:<hash>`
 * so different (template,data,format) combos hash distinctly while remaining
 * byte-stable across runs.
 *
 * Exported so other stub renderers can reuse the contract.
 */
export function stubRender<TData>(
  rendererId: string,
  input: RendererInput<TData>,
): RendererOutput {
  const payload = JSON.stringify({
    template: input.templateRef,
    data: input.data,
  });
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 32);
  const text = `STUB:${rendererId}:${input.format}:${input.templateRef}:${hash}`;
  return {
    buffer: new TextEncoder().encode(text),
    mimeType: MIME_TYPES[input.format as DocFormat],
  };
}

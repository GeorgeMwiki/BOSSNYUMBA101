/**
 * HTML → PDF renderer (Puppeteer / Playwright fallback).
 *
 * Used when the source artefact is already HTML — e.g. tenant ledger
 * dashboard exported from chat-ui — and a print-fidelity PDF is the
 * desired delivery format. The research report names Playwright the
 * 2026 winner over Puppeteer per npmtrends; both expose the same
 * `page.pdf()` surface.
 *
 * The real renderer launches a headless browser when
 * `PUPPETEER_HEADLESS=true` (or `PLAYWRIGHT_HEADLESS=true`) and a
 * factory is injected. Tests rely on the stub.
 *
 * Refs:
 *   - https://playwright.dev/docs/api/class-page#page-pdf
 *   - https://pptr.dev/api/puppeteer.page.pdf
 *   - .audit/litfin-sota-2026-05-23/19-document-generation.md §4 HTML→PDF
 */

import type {
  Renderer,
  RendererInput,
  RendererOutput,
} from '../types.js';
import { stubRender } from './carbone-renderer.js';

/**
 * Minimal browser abstraction the renderer needs. Real impls (Playwright
 * `chromium.launch().newPage()` or Puppeteer's `puppeteer.launch().newPage()`)
 * already satisfy this shape — pass them in via `factory`.
 */
export interface HtmlPdfBrowserPage {
  setContent(html: string): Promise<void>;
  pdf(options: { format?: string; printBackground?: boolean }): Promise<Uint8Array>;
  close(): Promise<void>;
}

export type HtmlPdfPageFactory = () => Promise<HtmlPdfBrowserPage>;

export interface PdfFromHtmlRendererOptions {
  /** True when the browser is wired and ready. Defaults to stub. */
  readonly headless?: boolean;
  /** Lazy factory — returns a browser page on demand. */
  readonly factory?: HtmlPdfPageFactory;
  /** Page size for the PDF (Playwright/Puppeteer naming: 'A4', 'Letter'). */
  readonly pageFormat?: string;
}

export class PdfFromHtmlRenderer implements Renderer {
  public readonly id = 'pdf-from-html';
  private readonly options: PdfFromHtmlRendererOptions;

  constructor(options: PdfFromHtmlRendererOptions = {}) {
    this.options = options;
  }

  public isStub(): boolean {
    return !this.options.headless || !this.options.factory;
  }

  async render<TData>(input: RendererInput<TData>): Promise<RendererOutput> {
    if (this.isStub()) {
      return stubRender(this.id, input);
    }
    if (input.format !== 'pdf') {
      throw new Error(
        `PdfFromHtmlRenderer only emits PDF; requested format=${input.format}`,
      );
    }

    // The "data" for this renderer is `{ html: string }` — the template
    // ref is treated as a debug label only.
    const html = (input.data as { html?: unknown }).html;
    if (typeof html !== 'string') {
      throw new Error(
        'PdfFromHtmlRenderer requires `data.html: string`',
      );
    }

    const factory = this.options.factory!;
    const page = await factory();
    try {
      await page.setContent(html);
      const buffer = await page.pdf({
        format: this.options.pageFormat ?? 'A4',
        printBackground: true,
      });
      return { buffer, mimeType: 'application/pdf' };
    } finally {
      await page.close();
    }
  }
}

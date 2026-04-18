/**
 * Document renderers — barrel export.
 *
 * IDocumentRenderer defines the common contract; concrete renderers:
 *  - TextRenderer              (plain text, implemented)
 *  - DocxtemplaterRenderer     (stub)
 *  - ReactPdfRenderer          (stub)
 *  - TypstRenderer             (stub)
 *  - NanoBananaImageryRenderer (MARKETING IMAGERY ONLY; stub)
 */

export * from './renderer-interface.js';
export * from './text-renderer.js';
export * from './docxtemplater-renderer.js';
export * from './react-pdf-renderer.js';
export * from './typst-renderer.js';
export * from './nano-banana-imagery-renderer.js';
export * from './renderer-factory.js';

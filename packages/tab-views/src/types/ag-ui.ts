/**
 * Minimal AG-UI part contract — structurally compatible with the
 * full UiPart union in `@bossnyumba/genui` but kept local so the
 * tab-views package has zero runtime deps on the renderer.
 *
 * `AgUiUiPart` is intentionally weakly-typed at the boundary
 * (`kind` + extra fields). The genui renderer's Zod validators are
 * the source of truth — the K-G render-tool calls them at emit
 * time to ensure the parts the MD streams to the client are
 * valid before they hit the wire.
 *
 * Why duplicate the contract instead of importing `@bossnyumba/genui`?
 *
 *   1. genui pulls in React + many UI libraries. The tab-views
 *      package runs in BOTH the kernel (Node) and the client (browser).
 *      We do not want React in the kernel bundle.
 *   2. The genui schemas are stable. Both sides re-validate at the
 *      boundary, so the contract drift surface is small.
 *
 * If you add a kind here you MUST also add it to
 * `packages/genui/src/schemas/index.ts` — the integration tests
 * pin all six sample views against the genui schemas.
 */

export type AgUiPartKind =
  | 'chart-vega'
  | 'data-table'
  | 'timeline'
  | 'kpi-grid'
  | 'prefill-form'
  | 'approval'
  | 'workflow'
  | 'map'
  | 'calendar'
  | 'file-preview'
  | 'kanban'
  | 'dashboard-grid'
  | 'heatmap'
  | 'markdown-card'
  | 'prompt-suggestions'
  | 'evidence-card'
  | 'tree'
  | 'diff-view'
  | 'gauge'
  | 'metric-sparkline'
  | 'image-annotation'
  | 'signature-pad'
  | 'pdf-viewer'
  | 'slider-input'
  | 'multistep-wizard'
  | 'media-grid'
  | 'chat-embed'
  | 'live-counter'
  | 'org-chart'
  | 'comparison-table'
  | 'geo-fence'
  | 'notification-toast'
  | 'decision-trace'
  | 'code-block'
  | 'dataflow-diagram';

/**
 * The base part contract — `kind` is the discriminator. Additional
 * fields are payload-specific and validated by the genui Zod
 * schemas at the render boundary.
 */
export interface AgUiUiPart {
  readonly kind: AgUiPartKind;
  readonly title?: string;
  readonly [extra: string]: unknown;
}

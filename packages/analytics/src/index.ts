/**
 * `@bossnyumba/analytics` — public surface.
 *
 * SOTA 2026 analytics + dashboards + AI-chart authoring.
 *
 * - Cube-style semantic layer (`defineMetric`, `defineDimension`,
 *   `defineCube`, `compileQuery`). Tenant-scoped by construction.
 * - Pluggable parsers: CSV (built-in), JSON (built-in), XLSX (port),
 *   PDF/scan via Unstructured.io + LlamaParse adapters.
 * - Vega-Lite v6 chart builders (added in subsystem 2).
 * - AI chart author — natural-language → chart spec via injectable
 *   multi-LLM brain (added in subsystem 2).
 * - Dashboard composition + SOTA templates (added in subsystem 3).
 * - Streaming bridge to `@bossnyumba/realtime-adapter` (added in
 *   subsystem 3).
 */

// Types (re-export everything)
export * from './types.js';

// Semantic layer
export {
  defineMetric,
  defineDimension,
  defineCube,
  compileQuery,
  evaluateMemory,
  type DefineCubeInput,
  type CompileError,
} from './semantic/index.js';

// Parsers
export {
  parseCsv,
  parseJson,
  parseXlsx,
  xlsxAdapterFromSheetjs,
  createUnstructuredParser,
  createLlamaParseParser,
  createParserRegistry,
  inferSchema,
  type CsvParseOptions,
  type DocumentParserRegistry,
  type InferSchemaOptions,
  type JsonParseOptions,
  type LlamaParseAdapterConfig,
  type UnstructuredAdapterConfig,
  type XlsxAdapter,
  type XlsxParseOptions,
} from './parsers/index.js';

// Charts (Vega-Lite v6 builders)
export {
  barChart,
  boxplotChart,
  funnelChart,
  gaugeChart,
  heatmapChart,
  kpiTile,
  lineChart,
  mapChart,
  pieChart,
  sankeyChart,
  scatterChart,
  CATEGORICAL_PALETTE,
  CHART_CONFIG,
  DIVERGING_PALETTE,
  SEQUENTIAL_PALETTE,
  VEGA_LITE_V6_SCHEMA,
  type BarChartInput,
  type BoxplotChartInput,
  type BuilderCommon,
  type FunnelChartInput,
  type GaugeChartInput,
  type HeatmapChartInput,
  type KpiTileInput,
  type LineChartInput,
  type MapChartInput,
  type PieChartInput,
  type SankeyChartInput,
  type ScatterChartInput,
} from './charts/index.js';

// AI Chart Author
export {
  authorChartFromQuestion,
  brainFromSynthesizer,
  pickTemplate,
  deterministicResponse,
  type AuthorChartInput,
  type ChartAuthorBrain,
  type SynthesizerLike,
} from './ai-chart-author/index.js';

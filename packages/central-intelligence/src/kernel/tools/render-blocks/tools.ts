/**
 * The 10 render-block tools the brain can call to emit generative UI.
 *
 * Each tool is a thin wrapper around `createRenderBlockTool` that
 * supplies the primitive-specific name, kind, description, Zod
 * schema, and a JSON Schema for the LLM tool-use input.
 *
 * The JSON Schemas here intentionally mirror the Zod schemas (just
 * loosely enough for Claude/OpenAI to construct valid inputs) — they
 * are NOT the source of truth. Zod is. If the model emits something
 * the JSON schema permits but Zod rejects, the tool returns a
 * `ToolOutcome.error` and the agent loop repairs.
 */

import { createRenderBlockTool } from './tool-factory.js';
import {
  ChartVegaPartSchema,
  DataTablePartSchema,
  TimelinePartSchema,
  KpiGridPartSchema,
  PrefillFormPartSchema,
  ApprovalPartSchema,
  WorkflowPartSchema,
  MapPartSchema,
  CalendarPartSchema,
  FilePreviewPartSchema,
} from './schemas.js';
import type { AgUiUiPartByKind } from './ag-ui-types.js';
import type { Tool } from '../../../types.js';

// ─────────────────────────────────────────────────────────────────────
// 1. chart-vega
// ─────────────────────────────────────────────────────────────────────

export const renderChartVegaTool: Tool<unknown, AgUiUiPartByKind<'chart-vega'>> =
  createRenderBlockTool<AgUiUiPartByKind<'chart-vega'>>({
    name: 'render-blocks.chart-vega',
    kind: 'chart-vega',
    description:
      'Render a chart in the admin console using a Vega-Lite v5 spec. ' +
      'Use for arrears trends, occupancy %, FX exposure, water consumption, ' +
      'or any time-series / categorical visual. The spec is validated ' +
      'with ajv before render; emit a complete spec, never a partial one.',
    schema: ChartVegaPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['spec', 'data'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        spec: {
          type: 'object',
          description: 'Vega-Lite v5 spec. Must include mark + encoding.',
        },
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Inline data rows the spec references via data:{values}.',
        },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 2. data-table
// ─────────────────────────────────────────────────────────────────────

export const renderDataTableTool: Tool<unknown, AgUiUiPartByKind<'data-table'>> =
  createRenderBlockTool<AgUiUiPartByKind<'data-table'>>({
    name: 'render-blocks.data-table',
    kind: 'data-table',
    description:
      'Render a sortable, filterable, CSV-exportable data table. Use for ' +
      'rent rolls, late-payer lists, maintenance backlogs, audit log slices.',
    schema: DataTablePartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['columns', 'rows'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'header', 'accessorKey'],
            properties: {
              id: { type: 'string' },
              header: { type: 'string' },
              accessorKey: { type: 'string' },
              format: {
                type: 'string',
                enum: ['text', 'currency', 'percent', 'number', 'date'],
              },
              currency: { type: 'string', enum: ['KES', 'TZS', 'USD'] },
              enableSorting: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        },
        rows: { type: 'array', items: { type: 'object' } },
        pageSize: { type: 'integer', minimum: 1, maximum: 500 },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 3. timeline
// ─────────────────────────────────────────────────────────────────────

export const renderTimelineTool: Tool<unknown, AgUiUiPartByKind<'timeline'>> =
  createRenderBlockTool<AgUiUiPartByKind<'timeline'>>({
    name: 'render-blocks.timeline',
    kind: 'timeline',
    description:
      'Render a vertical event timeline. Use for tenant lifecycle, payment ' +
      'history, complaint threads, audit-trail slices.',
    schema: TimelinePartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['events'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        events: {
          type: 'array',
          items: {
            type: 'object',
            required: ['timestamp', 'title'],
            properties: {
              timestamp: { type: 'string', description: 'ISO-8601' },
              title: { type: 'string' },
              description: { type: 'string' },
              severity: {
                type: 'string',
                enum: ['info', 'warn', 'error', 'success'],
              },
              icon: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 4. kpi-grid
// ─────────────────────────────────────────────────────────────────────

export const renderKpiGridTool: Tool<unknown, AgUiUiPartByKind<'kpi-grid'>> =
  createRenderBlockTool<AgUiUiPartByKind<'kpi-grid'>>({
    name: 'render-blocks.kpi-grid',
    kind: 'kpi-grid',
    description:
      'Render a KPI tile cluster (Tremor-style). Use for the dashboard ' +
      'hero: collected, due, occupancy, NOI, FX delta, arrears total.',
    schema: KpiGridPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['tiles'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        tiles: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'value', 'format'],
            properties: {
              label: { type: 'string' },
              value: { type: ['number', 'string'] },
              delta: { type: 'number' },
              deltaDirection: { type: 'string', enum: ['up', 'down', 'flat'] },
              format: { type: 'string', enum: ['currency', 'percent', 'number'] },
              currency: { type: 'string', enum: ['KES', 'TZS', 'USD'] },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 5. prefill-form
// ─────────────────────────────────────────────────────────────────────

export const renderPrefillFormTool: Tool<unknown, AgUiUiPartByKind<'prefill-form'>> =
  createRenderBlockTool<AgUiUiPartByKind<'prefill-form'>>({
    name: 'render-blocks.prefill-form',
    kind: 'prefill-form',
    description:
      'Render a prefilled form for the admin to review and submit. The ' +
      'schemaJson is SERVER-OWNED — supply it verbatim from the action ' +
      "registry; do NOT modify it. The brain emits VALUES against it. " +
      'Form submission POSTs to the action URL (api-gateway), not the agent.',
    schema: PrefillFormPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['formId', 'schemaJson', 'values', 'action'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        formId: { type: 'string' },
        schemaJson: {
          type: 'object',
          description:
            'JSON Schema Draft-7. Server-owned, supplied verbatim from registry.',
        },
        values: { type: 'object' },
        action: {
          type: 'string',
          description: 'Relative URL on api-gateway. NOT the agent endpoint.',
        },
        diffMode: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 6. approval
// ─────────────────────────────────────────────────────────────────────

export const renderApprovalTool: Tool<unknown, AgUiUiPartByKind<'approval'>> =
  createRenderBlockTool<AgUiUiPartByKind<'approval'>>({
    name: 'render-blocks.approval',
    kind: 'approval',
    description:
      'Render an HIL approval dialog with a diff preview and a 5-item ' +
      'challenge-and-response checklist (intent / data lineage / permissions ' +
      'chain / blast radius / rollback plan). User must ack every checklist ' +
      'item before the approve button enables. Required for destroy/billing tier.',
    schema: ApprovalPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['action', 'payload', 'diff', 'checklist'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        action: { type: 'string' },
        payload: { type: 'object' },
        diff: { type: 'object' },
        checklist: {
          type: 'array',
          minItems: 5,
          maxItems: 5,
          items: { type: 'string', maxLength: 280 },
        },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 7. workflow
// ─────────────────────────────────────────────────────────────────────

export const renderWorkflowTool: Tool<unknown, AgUiUiPartByKind<'workflow'>> =
  createRenderBlockTool<AgUiUiPartByKind<'workflow'>>({
    name: 'render-blocks.workflow',
    kind: 'workflow',
    description:
      'Render a horizontal stepper for a multi-step workflow. Use for ' +
      'onboarding, eviction, KRA filing, maintenance ticket lifecycle.',
    schema: WorkflowPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['steps', 'currentIndex'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'status'],
            properties: {
              label: { type: 'string' },
              status: {
                type: 'string',
                enum: ['pending', 'running', 'done', 'failed'],
              },
              startedAt: { type: 'string' },
              completedAt: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
        currentIndex: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 8. map
// ─────────────────────────────────────────────────────────────────────

export const renderMapTool: Tool<unknown, AgUiUiPartByKind<'map'>> =
  createRenderBlockTool<AgUiUiPartByKind<'map'>>({
    name: 'render-blocks.map',
    kind: 'map',
    description:
      'Render an OSM map with markers (react-leaflet + OpenStreetMap tiles). ' +
      'Use for property locations, inspection routes, geo-fenced arrears. ' +
      'NO Mapbox tokens — works offline in TZ field conditions when tile ' +
      'cache is warm.',
    schema: MapPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['center', 'zoom', 'markers'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        center: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number' },
          description: '[lat, lng]',
        },
        zoom: { type: 'integer', minimum: 0, maximum: 20 },
        markers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['position'],
            properties: {
              position: {
                type: 'array',
                minItems: 2,
                maxItems: 2,
                items: { type: 'number' },
              },
              popup: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 9. calendar
// ─────────────────────────────────────────────────────────────────────

export const renderCalendarTool: Tool<unknown, AgUiUiPartByKind<'calendar'>> =
  createRenderBlockTool<AgUiUiPartByKind<'calendar'>>({
    name: 'render-blocks.calendar',
    kind: 'calendar',
    description:
      'Render an interactive calendar (FullCalendar v6). Use for lease ' +
      'renewals, inspections, KRA deadlines, rent-due dates.',
    schema: CalendarPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['events'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        events: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'title', 'start'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              start: { type: 'string', description: 'ISO-8601' },
              end: { type: 'string' },
              color: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
        view: { type: 'string', enum: ['dayGrid', 'timeGrid', 'list'] },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// 10. file-preview
// ─────────────────────────────────────────────────────────────────────

export const renderFilePreviewTool: Tool<unknown, AgUiUiPartByKind<'file-preview'>> =
  createRenderBlockTool<AgUiUiPartByKind<'file-preview'>>({
    name: 'render-blocks.file-preview',
    kind: 'file-preview',
    description:
      'Render an inline file preview (PDF via react-pdf, image inline). Use ' +
      'for owner statements, signed leases, MRI receipts, ID scans.',
    schema: FilePreviewPartSchema,
    inputJsonSchema: {
      type: 'object',
      required: ['url', 'mimeType', 'name'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        url: { type: 'string' },
        mimeType: { type: 'string' },
        name: { type: 'string' },
        sizeBytes: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  });

// ─────────────────────────────────────────────────────────────────────
// Bundle — the convenience factory.
// ─────────────────────────────────────────────────────────────────────

export interface RenderBlockToolBundle {
  readonly chartVega: typeof renderChartVegaTool;
  readonly dataTable: typeof renderDataTableTool;
  readonly timeline: typeof renderTimelineTool;
  readonly kpiGrid: typeof renderKpiGridTool;
  readonly prefillForm: typeof renderPrefillFormTool;
  readonly approval: typeof renderApprovalTool;
  readonly workflow: typeof renderWorkflowTool;
  readonly map: typeof renderMapTool;
  readonly calendar: typeof renderCalendarTool;
  readonly filePreview: typeof renderFilePreviewTool;
  readonly all: ReadonlyArray<Tool>;
}

/**
 * Build the full render-block tool bundle. Wire into the
 * BrainToolRegistry alongside HQ tools (coordinate barrel with C2):
 *
 *   const renderBlocks = createRenderBlockTools();
 *   registry.registerAll(renderBlocks.all);
 */
export function createRenderBlockTools(): RenderBlockToolBundle {
  const all: ReadonlyArray<Tool> = Object.freeze([
    renderChartVegaTool,
    renderDataTableTool,
    renderTimelineTool,
    renderKpiGridTool,
    renderPrefillFormTool,
    renderApprovalTool,
    renderWorkflowTool,
    renderMapTool,
    renderCalendarTool,
    renderFilePreviewTool,
  ] as ReadonlyArray<Tool>);

  return {
    chartVega: renderChartVegaTool,
    dataTable: renderDataTableTool,
    timeline: renderTimelineTool,
    kpiGrid: renderKpiGridTool,
    prefillForm: renderPrefillFormTool,
    approval: renderApprovalTool,
    workflow: renderWorkflowTool,
    map: renderMapTool,
    calendar: renderCalendarTool,
    filePreview: renderFilePreviewTool,
    all,
  };
}

/**
 * Mobile-first responsive helpers for the chat timeline.
 *
 * On a screen narrower than {@link COLLAPSE_BREAKPOINT_PX}, large
 * genui parts (Vega charts, maps, big tables) collapse to a summary
 * card with a tap-to-expand affordance. This keeps the conversation
 * scannable on phones while still letting the owner pull the full
 * fidelity rendering on demand.
 */

import type { AgUiUiPart } from '@bossnyumba/genui';

export const COLLAPSE_BREAKPOINT_PX = 600;

const LARGE_KINDS: ReadonlyArray<AgUiUiPart['kind']> = [
  'chart-vega',
  'data-table',
  'map',
  'calendar',
  'kanban',
  'dashboard-grid',
  'heatmap',
  'org-chart',
  'comparison-table',
  'geo-fence',
  'media-grid',
  'pdf-viewer',
  'dataflow-diagram',
  'multistep-wizard',
  'tree',
];

const LARGE_KIND_SET: ReadonlySet<AgUiUiPart['kind']> = new Set(LARGE_KINDS);

export function shouldCollapseOnNarrow(part: AgUiUiPart): boolean {
  return LARGE_KIND_SET.has(part.kind);
}

/** Short, neutral summary shown when a block is collapsed under 600px. */
export function summarisePart(part: AgUiUiPart): string {
  switch (part.kind) {
    case 'chart-vega':
      return part.title ?? `Chart (${part.data.length} points)`;
    case 'data-table':
      return part.title ?? `Table (${part.rows.length} rows × ${part.columns.length} cols)`;
    case 'map':
      return part.title ?? `Map (${part.markers.length} markers)`;
    case 'calendar':
      return part.title ?? `Calendar (${part.events.length} events)`;
    case 'kpi-grid':
      return part.title ?? `${part.tiles.length} KPI tiles`;
    case 'approval':
      return part.title ?? 'Approval required';
    case 'workflow':
      return part.title ?? `Workflow (${part.steps.length} steps)`;
    case 'kanban':
      return part.title ?? `Kanban (${part.columns.length} columns)`;
    case 'comparison-table':
      return part.title ?? `Compare (${part.rows.length} rows)`;
    case 'media-grid':
      return part.title ?? `${part.items.length} media items`;
    case 'pdf-viewer':
      return part.title ?? part.name;
    case 'dataflow-diagram':
      return part.title ?? `Workflow (${part.nodes.length} nodes)`;
    case 'multistep-wizard':
      return part.title ?? `Wizard (${part.steps.length} steps)`;
    case 'tree':
      return part.title ?? `Tree (${part.root.label})`;
    default:
      return part.title ?? part.kind;
  }
}

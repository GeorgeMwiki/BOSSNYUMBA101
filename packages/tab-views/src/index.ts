/**
 * @bossnyumba/tab-views — Phase K-G.
 *
 * Universal in-chat tab rendering. The MD calls `renderTabInChat`
 * to emit any tab's primary view as ag-ui blocks inline in the
 * chat conversation. Tabs become a navigation convenience; chat
 * is the universal renderer.
 *
 * Public surface:
 *   - `renderTabInChat`              the LLM-facing tool
 *   - `TabViewRegistry`              the view registry (+ seed factory)
 *   - 6 sample TabView implementations
 *   - `BlackboardInteractionEvent`   the event protocol for in-chat
 *                                     interactivity (sort, drag, drill, …)
 *   - `CustomizationStore`           preference persistence
 *
 * Subpath imports are preferred:
 *
 *   import { renderTabInChat } from '@bossnyumba/tab-views/render-tool';
 *   import { TabViewRegistry } from '@bossnyumba/tab-views/registry';
 *   import { EmployeeTableView } from '@bossnyumba/tab-views/views';
 *
 * The barrel below re-exports the most-used surfaces for callers
 * that prefer to import from the package root.
 */

export * from './types/index.js';
export * from './registry/index.js';
export * from './render-tool/index.js';
export * from './interactivity/index.js';
export * from './customization/index.js';
export * from './views/index.js';

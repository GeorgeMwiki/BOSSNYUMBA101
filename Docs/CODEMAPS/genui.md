# GenUI Codemap

**Last Updated:** 2026-05-22
**Module:** `packages/genui/`
**Public entry:** `packages/genui/src/index.ts`
**Tier scope:** user surface (generative UI renderer)

## Purpose

The generative-UI renderer. The Brain returns a typed `AgUiUiPart`
descriptor (kind + props) and `AdaptiveRenderer` picks the right
primitive from a registry — Vega charts, data tables, timelines,
KPI grids, prefilled forms, approval dialogs, workflow steppers,
maps, calendars, file previews, Kanban, dashboard grids, heatmaps.
Unknown kinds render `UnknownKindCard` and emit a custom event so
ops can spot gaps.

## Entry points

- `src/index.ts` — barrel exporting `AdaptiveRenderer`,
  `GENUI_REGISTRY`, `GENUI_KINDS`, and each primitive component.
- `src/AdaptiveRenderer.tsx` — root component.
- `src/registry.ts` — `GENUI_REGISTRY: Record<kind, Component>`.
- `src/components/` — `VegaChart`, `DataTable`, `Timeline`, `KpiGrid`,
  `PrefillForm`, `ApprovalDialog`, `WorkflowStepper`, `MapView`,
  `CalendarView`, `FilePreview`, `Kanban`, `DashboardGrid`, `Heatmap`,
  `UnknownKindCard`.
- `src/schemas/` — Zod schemas for each kind's props.
- `src/validate.ts` — runtime validation.

## Internal structure

- `components/Frame.tsx` — wrapper providing skeleton + error boundary.
- `genui-host-actions.ts` — host action handlers (approve, submit, etc).
- `format.ts` — value formatters used by all components.

## Dependencies

- Upstream: `@bossnyumba/design-system`, Vega-Lite, Radix, zod.
- Downstream: chat-ui (renders streamed UI parts), owner-portal,
  estate-manager-app.

## Common workflows

- **Render a UI part** → `<AdaptiveRenderer part={part} onAction={fn} />`.
- **Add a new kind** → add Zod schema + component + registry entry +
  validate.ts case.
- **Handle action** → host listens via `genui-host-actions`.

## Anti-patterns to avoid

- Never render an unvalidated UI part — always `validate(part)` first.
- Never put business logic in a GenUI component — pure render.
- Never bypass the registry — extend it.
- Never swallow unknown-kind errors — let `UnknownKindCard` show.

## Related codemaps

- [chat-ui.md](./chat-ui.md) — streams UI parts to GenUI
- [design-system.md](./design-system.md) — primitives
- [central-intelligence.md](./central-intelligence.md) — emits UI parts

import dynamic from 'next/dynamic';

// `WorkOrderTriage` is the 324-line dispatch / triage board — heaviest
// screen in the work-orders area. Defer it via next/dynamic so the
// initial route bundle for /work-orders/[id]/triage stays small;
// the triage view loads only when the user actually opens it.
//
// `ssr: false` because the dispatch board uses drag-and-drop +
// react-query mutation handlers — both are client-only concerns.
//
// Cite: nextjs.org/docs/app/getting-started/partial-prerendering
// (Next.js 15 PPR + dynamic-import pattern).
const WorkOrderTriage = dynamic(
  () =>
    import('@/screens/work-orders/WorkOrderTriage.js').then(
      (m) => m.default,
    ),
  {
    ssr: false,
    loading: () => (
      <div role="status" aria-live="polite" className="p-6 text-sm text-gray-500">
        Loading triage board…
      </div>
    ),
  },
);

export default function WorkOrderTriagePage() {
  return <WorkOrderTriage />;
}

import React, { useMemo, useState } from 'react';

/**
 * PlanTree — recursive, collapsible plan tree component. The MDR plan
 * cascades annual → quarterly → monthly → weekly → daily; each node is
 * a `MdrPlanItem` row. Owner interactions (accept / reject / propose
 * child) are surfaced through the `onAction` callback so the page can
 * wire them to the gateway endpoint.
 *
 * Kept hand-rolled (no `react-arborist` runtime dep needed yet) — the
 * tree depth is bounded to 5 horizons and the typical owner has well
 * under 100 active items, so DOM cost is trivial.
 */

export type MdrPlanHorizon =
  | 'annual'
  | 'quarterly'
  | 'monthly'
  | 'weekly'
  | 'daily';

export type MdrPlanStatus =
  | 'proposed'
  | 'active'
  | 'paused'
  | 'done'
  | 'cancelled';

export interface PlanItem {
  readonly id: string;
  readonly parentId: string | null;
  readonly horizon: MdrPlanHorizon;
  readonly title: string;
  readonly description?: string | null;
  readonly status: MdrPlanStatus;
  readonly proposedBy: 'md' | 'owner';
  readonly startDate?: string | null;
  readonly dueDate?: string | null;
  readonly ownerEditable?: boolean;
}

export interface PlanTreeAction {
  readonly kind: 'accept' | 'reject' | 'pause' | 'resume' | 'complete' | 'propose-child';
  readonly itemId: string;
}

const STATUS_PILL: Record<MdrPlanStatus, string> = {
  proposed: 'bg-amber-100 text-amber-900',
  active: 'bg-emerald-100 text-emerald-900',
  paused: 'bg-gray-100 text-gray-700',
  done: 'bg-blue-100 text-blue-900',
  cancelled: 'bg-red-100 text-red-900',
};

const HORIZON_BORDER: Record<MdrPlanHorizon, string> = {
  annual: 'border-l-4 border-indigo-600',
  quarterly: 'border-l-4 border-violet-600',
  monthly: 'border-l-4 border-blue-600',
  weekly: 'border-l-4 border-emerald-600',
  daily: 'border-l-4 border-amber-600',
};

interface TreeNode extends PlanItem {
  readonly children: TreeNode[];
}

function buildTree(items: ReadonlyArray<PlanItem>): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const it of items) {
    byId.set(it.id, { ...it, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface RowProps {
  readonly node: TreeNode;
  readonly depth: number;
  readonly onAction: (a: PlanTreeAction) => void;
  readonly initiallyOpen: boolean;
}

function PlanRow({ node, depth, onAction, initiallyOpen }: RowProps): JSX.Element {
  const [open, setOpen] = useState<boolean>(initiallyOpen);
  const hasChildren = node.children.length > 0;
  return (
    <li className="list-none">
      <div
        className={`my-1 flex items-start gap-2 rounded bg-white p-2 shadow-sm ${HORIZON_BORDER[node.horizon]}`}
        style={{ marginLeft: depth * 16 }}
      >
        <button
          type="button"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen((v) => !v)}
          className={`mt-0.5 w-4 text-xs text-gray-500 ${hasChildren ? '' : 'invisible'}`}
        >
          {open ? '▾' : '▸'}
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-500">
              {node.horizon}
            </span>
            <span className="font-medium text-gray-900">{node.title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[node.status]}`}
            >
              {node.status}
            </span>
            {node.dueDate ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                due {node.dueDate}
              </span>
            ) : null}
            <span className="ml-auto text-[10px] text-gray-400">
              by {node.proposedBy}
            </span>
          </div>
          {node.description ? (
            <div className="mt-1 text-sm text-gray-600">{node.description}</div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            {node.status === 'proposed' ? (
              <>
                <button
                  type="button"
                  onClick={() => onAction({ kind: 'accept', itemId: node.id })}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-900"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onAction({ kind: 'reject', itemId: node.id })}
                  className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-red-900"
                >
                  Reject
                </button>
              </>
            ) : null}
            {node.status === 'active' ? (
              <>
                <button
                  type="button"
                  onClick={() => onAction({ kind: 'pause', itemId: node.id })}
                  className="rounded border border-gray-300 bg-white px-2 py-0.5"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => onAction({ kind: 'complete', itemId: node.id })}
                  className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-900"
                >
                  Mark done
                </button>
              </>
            ) : null}
            {node.status === 'paused' ? (
              <button
                type="button"
                onClick={() => onAction({ kind: 'resume', itemId: node.id })}
                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-900"
              >
                Resume
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onAction({ kind: 'propose-child', itemId: node.id })}
              className="rounded border border-gray-200 bg-white px-2 py-0.5 text-gray-700"
            >
              + sub-item
            </button>
          </div>
        </div>
      </div>
      {hasChildren && open ? (
        <ul className="m-0 p-0">
          {node.children.map((c) => (
            <PlanRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onAction={onAction}
              initiallyOpen={depth < 2}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export interface PlanTreeProps {
  readonly items: ReadonlyArray<PlanItem>;
  readonly horizonFilter?: MdrPlanHorizon | 'all';
  readonly onAction: (a: PlanTreeAction) => void;
}

export function PlanTree({
  items,
  horizonFilter = 'all',
  onAction,
}: PlanTreeProps): JSX.Element {
  const filtered = useMemo(() => {
    if (horizonFilter === 'all') return items;
    // Keep ancestors of any matching item so the tree stays well-formed.
    const matchIds = new Set(items.filter((i) => i.horizon === horizonFilter).map((i) => i.id));
    const byId = new Map(items.map((i) => [i.id, i]));
    const keep = new Set<string>();
    for (const id of matchIds) {
      let cur: PlanItem | undefined = byId.get(id);
      while (cur) {
        keep.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    }
    return items.filter((i) => keep.has(i.id));
  }, [items, horizonFilter]);

  const roots = useMemo(() => buildTree(filtered), [filtered]);

  if (roots.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        No plan items at this horizon yet.
      </div>
    );
  }

  return (
    <ul className="m-0 p-0">
      {roots.map((r) => (
        <PlanRow
          key={r.id}
          node={r}
          depth={0}
          onAction={onAction}
          initiallyOpen={true}
        />
      ))}
    </ul>
  );
}

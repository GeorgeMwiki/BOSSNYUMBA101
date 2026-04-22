'use client';

/**
 * GraphExplorer — the client-side, interactive portion of /graph.
 *
 * Responsibilities:
 *   1. Search form (Zod-validated) → hits /api/v1/graph/query
 *   2. Fetch neighbourhood (1-hop or 2-hop, depth clamped to 3)
 *   3. Run a tiny hand-rolled force-ish layout (concentric rings from focus)
 *   4. Render an SVG canvas with circles + lines
 *   5. Render a right-pane detail view for the selected node
 *   6. Keyboard navigation: ←↑↓→ moves focus to the nearest neighbour
 *   7. Degraded-state rendering for 401 / 403 / 404 / 503
 *
 * Immutability: every state update returns a new object. No mutation of
 * nodes / edges arrays after they enter state.
 *
 * No external viz libs. SVG + React only.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  AlertTriangle,
  Crosshair,
  Lock,
  Network,
  Search,
  ShieldAlert,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  cn,
} from '@bossnyumba/design-system';

/* ─────────────────────────────  Types  ───────────────────────────── */

type NodeLabel =
  | 'Property'
  | 'Unit'
  | 'Tenant'
  | 'Vendor'
  | 'Incident'
  | 'Payment'
  | 'Policy'
  | 'Case'
  | 'Document';

const NODE_LABELS: readonly NodeLabel[] = [
  'Property',
  'Unit',
  'Tenant',
  'Vendor',
  'Incident',
  'Payment',
  'Policy',
  'Case',
  'Document',
];

interface GraphNode {
  readonly id: string;
  readonly label: NodeLabel;
  readonly name: string;
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
}

interface GraphEdge {
  readonly id: string;
  readonly type: string;
  readonly from: string; // node id
  readonly to: string;   // node id
  readonly attributes?: Readonly<Record<string, string | number | boolean | null>>;
}

interface Neighbourhood {
  readonly focus: GraphNode;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

type Depth = 1 | 2;

type FetchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly data: Neighbourhood }
  | { readonly kind: 'empty'; readonly query: string } // 404 / no results
  | { readonly kind: 'unauthorized' }                  // 401
  | { readonly kind: 'forbidden' }                     // 403
  | { readonly kind: 'unavailable' }                   // 503
  | { readonly kind: 'error'; readonly message: string };

/* ───────────────────────  Zod search schema  ─────────────────────── */

const searchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(120),
});

/* ─────────────────────────  API helpers  ─────────────────────────── */

function getApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function getAuthHeader(): Readonly<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('manager_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface CallResult<T> {
  readonly status: number;
  readonly data: T | null;
}

async function apiCall<T>(
  path: string,
  init?: RequestInit,
): Promise<CallResult<T>> {
  const base = getApiBase();
  if (!base) {
    return { status: 503, data: null };
  }
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...(init?.headers ?? {}),
      },
      credentials: 'include',
    });
    if (!res.ok) return { status: res.status, data: null };
    const body = (await res.json()) as T;
    return { status: res.status, data: body };
  } catch (error) {
    console.error('graph api call failed', error);
    return { status: 0, data: null };
  }
}

/* ────────────────────  Force-ish ring layout  ─────────────────────── */

interface Positioned {
  readonly node: GraphNode;
  readonly ringIdx: number;
  readonly x: number;
  readonly y: number;
}

interface LayoutResult {
  readonly positions: ReadonlyMap<string, Positioned>;
  readonly width: number;
  readonly height: number;
}

/**
 * Place the focus node at centre; distribute neighbours at hop-distance
 * on concentric rings. Each ring is evenly divided by angle. Pure
 * deterministic — no mutation, no randomness.
 */
function layoutNeighbourhood(
  neighbourhood: Neighbourhood,
  width: number,
  height: number,
): LayoutResult {
  const cx = width / 2;
  const cy = height / 2;
  const ringGap = Math.min(width, height) * 0.32;

  // BFS from focus to compute hop depth per node.
  const adjacency = new Map<string, Set<string>>();
  neighbourhood.edges.forEach((e) => {
    if (!adjacency.has(e.from)) adjacency.set(e.from, new Set());
    if (!adjacency.has(e.to)) adjacency.set(e.to, new Set());
    adjacency.get(e.from)!.add(e.to);
    adjacency.get(e.to)!.add(e.from);
  });

  const depths = new Map<string, number>([[neighbourhood.focus.id, 0]]);
  const queue: string[] = [neighbourhood.focus.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) ?? 0;
    const neighbours = adjacency.get(current) ?? new Set();
    neighbours.forEach((n) => {
      if (!depths.has(n)) {
        depths.set(n, currentDepth + 1);
        queue.push(n);
      }
    });
  }

  // Group nodes by ring.
  const rings = new Map<number, GraphNode[]>();
  neighbourhood.nodes.forEach((n) => {
    const d = depths.get(n.id) ?? 1;
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d)!.push(n);
  });

  const positions = new Map<string, Positioned>();
  rings.forEach((ringNodes, ringIdx) => {
    if (ringIdx === 0) {
      positions.set(neighbourhood.focus.id, {
        node: neighbourhood.focus,
        ringIdx: 0,
        x: cx,
        y: cy,
      });
      return;
    }
    const radius = ringGap * ringIdx;
    const count = ringNodes.length;
    ringNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
      positions.set(node.id, {
        node,
        ringIdx,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  });

  return { positions, width, height };
}

/* ─────────────────────────  Colour tokens  ───────────────────────── */

// All colours map to design-system CSS vars — NO raw hex.
const LABEL_STYLES: Record<NodeLabel, { readonly ring: string; readonly fill: string; readonly text: string }> = {
  Property:  { ring: 'stroke-signal-500',    fill: 'fill-signal-500/15',     text: 'text-signal-500'    },
  Unit:      { ring: 'stroke-info',          fill: 'fill-info/15',           text: 'text-info'          },
  Tenant:    { ring: 'stroke-success',       fill: 'fill-success/15',        text: 'text-success'       },
  Vendor:    { ring: 'stroke-warning',       fill: 'fill-warning/15',        text: 'text-warning'       },
  Incident:  { ring: 'stroke-danger',        fill: 'fill-danger/15',         text: 'text-danger'        },
  Payment:   { ring: 'stroke-success',       fill: 'fill-success/10',        text: 'text-success'       },
  Policy:    { ring: 'stroke-neutral-500',   fill: 'fill-neutral-500/15',    text: 'text-neutral-500'   },
  Case:      { ring: 'stroke-danger',        fill: 'fill-danger/10',         text: 'text-danger'        },
  Document:  { ring: 'stroke-info',          fill: 'fill-info/10',           text: 'text-info'          },
};

/* ──────────────────────────  Component  ──────────────────────────── */

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 560;

export function GraphExplorer(): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [depth, setDepth] = useState<Depth>(1);
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [excludedEdgeTypes, setExcludedEdgeTypes] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const canvasRef = useRef<SVGSVGElement | null>(null);

  /* ── Search submission ─────────────────────────────────────────── */

  const runSearch = useCallback(
    async (rawQuery: string, hopDepth: Depth): Promise<void> => {
      const parsed = searchSchema.safeParse({ q: rawQuery });
      if (!parsed.success) {
        setQueryError(parsed.error.issues[0]?.message ?? 'Invalid query');
        return;
      }
      setQueryError(null);
      setState({ kind: 'loading' });

      // Step 1 — resolve query to a node.
      const resolve = await apiCall<{
        readonly label: NodeLabel;
        readonly id: string;
      }>('/api/v1/graph/query', {
        method: 'POST',
        body: JSON.stringify({ q: parsed.data.q }),
      });

      if (resolve.status === 401) return setState({ kind: 'unauthorized' });
      if (resolve.status === 403) return setState({ kind: 'forbidden' });
      if (resolve.status === 503 || resolve.status === 0) return setState({ kind: 'unavailable' });
      if (resolve.status === 404 || !resolve.data) {
        return setState({ kind: 'empty', query: parsed.data.q });
      }

      // Step 2 — fetch neighbourhood for resolved node.
      const qs = new URLSearchParams({
        label: resolve.data.label,
        id: resolve.data.id,
        depth: String(hopDepth),
      });
      const hood = await apiCall<Neighbourhood>(
        `/api/v1/graph/neighbourhood?${qs.toString()}`,
      );

      if (hood.status === 401) return setState({ kind: 'unauthorized' });
      if (hood.status === 403) return setState({ kind: 'forbidden' });
      if (hood.status === 503 || hood.status === 0) return setState({ kind: 'unavailable' });
      if (hood.status === 404 || !hood.data) {
        return setState({ kind: 'empty', query: parsed.data.q });
      }

      setState({ kind: 'success', data: hood.data });
      setSelectedId(hood.data.focus.id);
    },
    [],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runSearch(query, depth);
  };

  /* ── Re-fetch when depth changes (if we already have data) ─────── */

  const hasData = state.kind === 'success';
  useEffect(() => {
    if (hasData && query) {
      void runSearch(query, depth);
    }
    // Only re-run when depth changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);

  /* ── Derived data for filtered view ────────────────────────────── */

  const filteredData = useMemo<Neighbourhood | null>(() => {
    if (state.kind !== 'success') return null;
    const d = state.data;
    if (excludedEdgeTypes.size === 0) return d;
    const keptEdges = d.edges.filter((e) => !excludedEdgeTypes.has(e.type));
    const keptNodeIds = new Set<string>([d.focus.id]);
    keptEdges.forEach((e) => {
      keptNodeIds.add(e.from);
      keptNodeIds.add(e.to);
    });
    const keptNodes = d.nodes.filter((n) => keptNodeIds.has(n.id));
    return { focus: d.focus, nodes: keptNodes, edges: keptEdges };
  }, [state, excludedEdgeTypes]);

  const layout = useMemo<LayoutResult | null>(() => {
    if (!filteredData) return null;
    return layoutNeighbourhood(filteredData, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [filteredData]);

  const edgeTypes = useMemo<readonly string[]>(() => {
    if (state.kind !== 'success') return [];
    return Array.from(new Set(state.data.edges.map((e) => e.type))).sort();
  }, [state]);

  const selectedNode = useMemo<GraphNode | null>(() => {
    if (!filteredData || !selectedId) return null;
    if (selectedId === filteredData.focus.id) return filteredData.focus;
    return filteredData.nodes.find((n) => n.id === selectedId) ?? null;
  }, [filteredData, selectedId]);

  const selectedEdges = useMemo<{ readonly outgoing: readonly GraphEdge[]; readonly incoming: readonly GraphEdge[] }>(() => {
    if (!filteredData || !selectedNode) return { outgoing: [], incoming: [] };
    return {
      outgoing: filteredData.edges.filter((e) => e.from === selectedNode.id),
      incoming: filteredData.edges.filter((e) => e.to === selectedNode.id),
    };
  }, [filteredData, selectedNode]);

  /* ── Keyboard: arrow keys move focus to nearest neighbour ──────── */

  const onCanvasKeyDown = useCallback(
    (event: KeyboardEvent<SVGSVGElement>): void => {
      if (!layout || !selectedId) return;
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      const currentPos = layout.positions.get(selectedId);
      if (!currentPos) return;

      // Candidates: nodes connected by any edge to current.
      const connectedIds = new Set<string>();
      filteredData?.edges.forEach((e) => {
        if (e.from === selectedId) connectedIds.add(e.to);
        if (e.to === selectedId) connectedIds.add(e.from);
      });

      const candidates: Positioned[] = [];
      connectedIds.forEach((id) => {
        const p = layout.positions.get(id);
        if (p) candidates.push(p);
      });
      if (candidates.length === 0) return;

      const dir = event.key;
      const scored = candidates
        .map((c) => {
          const dx = c.x - currentPos.x;
          const dy = c.y - currentPos.y;
          let score = Infinity;
          if (dir === 'ArrowRight' && dx > 0) score = Math.abs(dy) + dx;
          else if (dir === 'ArrowLeft' && dx < 0) score = Math.abs(dy) - dx;
          else if (dir === 'ArrowDown' && dy > 0) score = Math.abs(dx) + dy;
          else if (dir === 'ArrowUp' && dy < 0) score = Math.abs(dx) - dy;
          return { c, score };
        })
        .filter((s) => s.score !== Infinity)
        .sort((a, b) => a.score - b.score);

      const next = scored[0];
      if (next) setSelectedId(next.c.node.id);
    },
    [layout, selectedId, filteredData],
  );

  /* ── Re-centre on a node ───────────────────────────────────────── */

  const refocusOn = useCallback(
    (node: GraphNode): void => {
      void runSearch(node.name, depth);
    },
    [runSearch, depth],
  );

  /* ── Edge-type pill toggle ─────────────────────────────────────── */

  const toggleEdgeType = useCallback((type: string): void => {
    setExcludedEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  /* ── Redirect on 401 ───────────────────────────────────────────── */

  useEffect(() => {
    if (state.kind === 'unauthorized' && typeof window !== 'undefined') {
      const timer = window.setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state.kind]);

  /* ─────────────────────────  Render  ─────────────────────────── */

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:gap-6">
      {/* Left rail — search + depth + filters */}
      <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
          <label
            htmlFor="graph-search"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500"
          >
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              id="graph-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Unit 4B, Grace Otieno"
              className={cn(
                'w-full rounded-md border bg-surface py-2 pl-9 pr-3 text-sm text-foreground',
                'placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-signal-500',
                queryError ? 'border-danger' : 'border-border',
              )}
              aria-invalid={queryError ? 'true' : 'false'}
              aria-describedby={queryError ? 'graph-search-error' : undefined}
            />
          </div>
          {queryError && (
            <p id="graph-search-error" className="text-xs text-danger">
              {queryError}
            </p>
          )}
          <Button type="submit" size="sm" disabled={state.kind === 'loading'}>
            {state.kind === 'loading' ? 'Searching…' : 'Explore'}
          </Button>
        </form>

        {/* Depth segmented control */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            Depth
          </span>
          <div
            role="radiogroup"
            aria-label="Traversal depth"
            className="inline-flex rounded-md border border-border bg-surface p-0.5"
          >
            {([1, 2] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={depth === d}
                onClick={() => setDepth(d)}
                className={cn(
                  'flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors',
                  depth === d
                    ? 'bg-signal-500 text-primary-foreground'
                    : 'text-neutral-500 hover:text-foreground',
                )}
              >
                {d}-hop
              </button>
            ))}
          </div>
          <p className="text-[0.68rem] text-neutral-500">Max depth clamped to 3.</p>
        </div>

        {/* Edge-type pills */}
        {edgeTypes.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              Edge types
            </span>
            <div className="flex flex-wrap gap-1.5">
              {edgeTypes.map((t) => {
                const excluded = excludedEdgeTypes.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleEdgeType(t)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors',
                      excluded
                        ? 'border-border bg-transparent text-neutral-500 line-through'
                        : 'border-signal-500/40 bg-signal-500/10 text-signal-500',
                    )}
                    aria-pressed={!excluded}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="hidden flex-col gap-2 lg:flex">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            Legend
          </span>
          <ul className="flex flex-col gap-1.5">
            {NODE_LABELS.map((l) => (
              <li key={l} className="flex items-center gap-2 text-xs text-neutral-500">
                <span
                  className={cn(
                    'inline-block h-2.5 w-2.5 rounded-full border',
                    LABEL_STYLES[l].fill.replace('fill-', 'bg-'),
                    LABEL_STYLES[l].ring.replace('stroke-', 'border-'),
                  )}
                />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Centre canvas */}
      <section className="min-w-0">
        <CanvasFrame
          state={state}
          layout={layout}
          data={filteredData}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onKeyDown={onCanvasKeyDown}
          canvasRef={canvasRef}
        />
      </section>

      {/* Right detail pane */}
      <aside>
        <DetailPane
          node={selectedNode}
          edges={selectedEdges}
          onRefocus={refocusOn}
          disabled={state.kind !== 'success'}
        />
      </aside>
    </div>
  );
}

/* ─────────────────────────  Canvas frame  ─────────────────────────── */

interface CanvasFrameProps {
  readonly state: FetchState;
  readonly layout: LayoutResult | null;
  readonly data: Neighbourhood | null;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => void;
  readonly canvasRef: React.RefObject<SVGSVGElement>;
}

function CanvasFrame({
  state,
  layout,
  data,
  selectedId,
  onSelect,
  onKeyDown,
  canvasRef,
}: CanvasFrameProps): JSX.Element {
  if (state.kind === 'idle') {
    return (
      <Card className="flex h-[560px] items-center justify-center border-dashed">
        <Empty
          variant="search"
          icon={<Network className="h-8 w-8 text-signal-500" />}
          title="Start by searching for a unit, tenant, vendor, or incident"
          description="Results are limited to your assigned portfolio. Use two or more characters."
        />
      </Card>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Card className="flex h-[560px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-500">
          <Network className="h-6 w-6 animate-pulse text-signal-500" />
          <p className="font-mono text-xs uppercase tracking-widest">Traversing graph…</p>
        </div>
      </Card>
    );
  }

  if (state.kind === 'unauthorized') {
    return (
      <DegradedCard
        icon={<Lock className="h-8 w-8 text-warning" />}
        title="Your session has expired"
        body="Redirecting to the sign-in screen…"
        tone="warning"
      />
    );
  }

  if (state.kind === 'forbidden') {
    return (
      <DegradedCard
        icon={<ShieldAlert className="h-8 w-8 text-danger" />}
        title="You need property-manager or higher"
        body="The relationship explorer exposes cross-tenant connections. Ask your admin to grant the property-manager role."
        tone="danger"
      />
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <DegradedCard
        icon={<WifiOff className="h-8 w-8 text-neutral-500" />}
        title="Graph service isn't wired on this environment — ask ops"
        body="The /api/v1/graph/* endpoints returned 503. Once ops flips the feature flag this page will come alive automatically."
        tone="neutral"
      />
    );
  }

  if (state.kind === 'empty') {
    return (
      <Card className="flex h-[560px] items-center justify-center">
        <Empty
          variant="search"
          title={`No match for "${state.query}"`}
          description="Try a different name, a partial unit number, or ask Mwikila to find it for you."
        />
      </Card>
    );
  }

  if (state.kind === 'error') {
    return (
      <DegradedCard
        icon={<AlertTriangle className="h-8 w-8 text-danger" />}
        title="Something went wrong"
        body={state.message}
        tone="danger"
      />
    );
  }

  // success
  if (!layout || !data) return <></>;

  return (
    <Card className="overflow-hidden">
      <svg
        ref={canvasRef}
        role="img"
        aria-label="Graph visualisation"
        tabIndex={0}
        onKeyDown={onKeyDown}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="block h-auto w-full bg-surface focus:outline-none focus:ring-2 focus:ring-signal-500"
      >
        {/* Edges under nodes */}
        <g>
          {data.edges.map((edge) => {
            const from = layout.positions.get(edge.from);
            const to = layout.positions.get(edge.to);
            if (!from || !to) return null;
            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="stroke-border"
                  strokeWidth={1}
                  strokeOpacity={0.7}
                />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  textAnchor="middle"
                  className="fill-neutral-500 font-mono"
                  style={{ fontSize: 9, letterSpacing: 1 }}
                >
                  {edge.type}
                </text>
              </g>
            );
          })}
        </g>
        {/* Nodes on top */}
        <g>
          {Array.from(layout.positions.values()).map((p) => {
            const style = LABEL_STYLES[p.node.label];
            const isSelected = p.node.id === selectedId;
            const r = p.ringIdx === 0 ? 34 : 22;
            return (
              <g
                key={p.node.id}
                role="button"
                tabIndex={-1}
                onClick={() => onSelect(p.node.id)}
                className="cursor-pointer"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r + 6}
                  className={cn(
                    'fill-transparent transition-all',
                    isSelected ? 'stroke-signal-500' : 'stroke-transparent',
                  )}
                  strokeWidth={2}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  className={cn(style.fill, style.ring)}
                  strokeWidth={2}
                />
                <text
                  x={p.x}
                  y={p.y - r - 6}
                  textAnchor="middle"
                  className={cn('fill-foreground', 'font-mono')}
                  style={{ fontSize: 10 }}
                >
                  {p.node.label}
                </text>
                <text
                  x={p.x}
                  y={p.y + 3}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {truncate(p.node.name, p.ringIdx === 0 ? 14 : 10)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </Card>
  );
}

/* ────────────────────────  Detail pane  ───────────────────────────── */

interface DetailPaneProps {
  readonly node: GraphNode | null;
  readonly edges: { readonly outgoing: readonly GraphEdge[]; readonly incoming: readonly GraphEdge[] };
  readonly onRefocus: (node: GraphNode) => void;
  readonly disabled: boolean;
}

function DetailPane({ node, edges, onRefocus, disabled }: DetailPaneProps): JSX.Element {
  if (!node) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            Click a node in the canvas to see its attributes and edges.
          </p>
        </CardContent>
      </Card>
    );
  }

  const attrEntries = Object.entries(node.attributes);
  const style = LABEL_STYLES[node.label];

  return (
    <Card>
      <CardHeader bordered>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('font-mono text-[0.68rem] uppercase tracking-widest', style.text)}>
              {node.label}
            </p>
            <CardTitle className="mt-1 truncate text-base" title={node.name}>
              {node.name}
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRefocus(node)}
            disabled={disabled}
          >
            <Crosshair className="mr-1 h-3.5 w-3.5" />
            Focus
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <section className="flex flex-col gap-3">
          <h4 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            Attributes
          </h4>
          {attrEntries.length === 0 ? (
            <p className="text-xs text-neutral-500">No attributes returned.</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {attrEntries.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="truncate text-foreground" title={String(v ?? '—')}>
                    {v === null || v === undefined ? '—' : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="mt-5 flex flex-col gap-3">
          <h4 className="flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            <span>Outgoing</span>
            <Badge variant="outline" size="sm">
              {edges.outgoing.length}
            </Badge>
          </h4>
          <EdgeList edges={edges.outgoing} direction="out" />
        </section>

        <section className="mt-4 flex flex-col gap-3">
          <h4 className="flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            <span>Incoming</span>
            <Badge variant="outline" size="sm">
              {edges.incoming.length}
            </Badge>
          </h4>
          <EdgeList edges={edges.incoming} direction="in" />
        </section>
      </CardContent>
    </Card>
  );
}

function EdgeList({
  edges,
  direction,
}: {
  readonly edges: readonly GraphEdge[];
  readonly direction: 'in' | 'out';
}): JSX.Element {
  if (edges.length === 0) {
    return <p className="text-xs text-neutral-500">None.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {edges.slice(0, 20).map((e) => (
        <li
          key={e.id}
          className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1.5 text-xs"
        >
          <Badge variant="secondary" size="sm">
            {e.type}
          </Badge>
          <span className="truncate text-neutral-500">
            {direction === 'out' ? `→ ${e.to}` : `← ${e.from}`}
          </span>
        </li>
      ))}
      {edges.length > 20 && (
        <li className="text-[0.68rem] text-neutral-500">
          +{edges.length - 20} more
        </li>
      )}
    </ul>
  );
}

/* ──────────────────────  Degraded state card  ─────────────────────── */

function DegradedCard({
  icon,
  title,
  body,
  tone,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly body: string;
  readonly tone: 'warning' | 'danger' | 'neutral';
}): JSX.Element {
  const toneBorder =
    tone === 'warning'
      ? 'border-warning/40'
      : tone === 'danger'
        ? 'border-danger/40'
        : 'border-border';
  return (
    <Card className={cn('flex h-[560px] items-center justify-center border', toneBorder)}>
      <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        {icon}
        <h3 className="font-display text-xl font-medium tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-neutral-500">{body}</p>
      </div>
    </Card>
  );
}

/* ──────────────────────────────  Utils  ──────────────────────────── */

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

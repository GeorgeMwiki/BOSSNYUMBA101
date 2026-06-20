/**
 * Manager task-queue hooks — commercial chain L4.
 *
 * Backs the manager dispatch screens in `app/(manager)/tasks/*`:
 *   - useManagerOpenTasks: live list of `maintenance_tasks` (work-order)
 *     rows in the manager's tenant, optionally filtered by property/status.
 *     Drives the manager's "to dispatch" queue.
 *   - useAssignTaskToWorker: mutation that assigns a work order to a staff
 *     member, which emits an audit-chain entry + (optionally) records the
 *     shift id on provenance.
 *
 * Endpoints: the open-task queue reads GET /work-orders?status=... (mounted
 * /api/v1/work-orders). Assignment is done via the HR assignments surface —
 * POST /api/v1/hr/assignments { assigneeEmployeeId, title, linkedEntityId } —
 * because there is no literal /work-orders/:id/assign-worker action. The work
 * order id is carried as `linkedEntityId` so the assignment row links back to
 * the dispatched work order.
 *
 * Each hook deals only with normalized snake_case rows the api-gateway
 * returns; renamers stay at the call site.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { managerApi } from '../api/client'

// Manager dispatch is a single canonical write on the estate-manager router:
// POST /api/v1/manager/work-orders/:id/assign-worker (mounted at /api/v1/manager).
// It stamps the canonical work_orders.assigned_to_user_id (migration 0340) and
// creates the bridge `assignments` row in one server-side transaction.

export interface MaintenanceTaskRow {
  readonly id: string
  readonly tenantId: string
  readonly propertyId: string | null
  readonly assignedToUserId: string | null
  readonly assignedByUserId: string | null
  readonly titleSw: string
  readonly titleEn: string | null
  readonly descriptionSw: string | null
  readonly descriptionEn: string | null
  readonly priority: 'low' | 'normal' | 'high' | 'urgent'
  readonly status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'cancelled'
  readonly kind: 'standard' | 'application_fulfil' | 'inspection' | 'maintenance'
  readonly parentApplicationId: string | null
  readonly dueAt: string | null
  readonly createdAt: string
}

interface ListTasksResponse {
  readonly success?: boolean
  readonly data?: ReadonlyArray<Record<string, unknown>>
}

function adaptTaskRow(r: Record<string, unknown>): MaintenanceTaskRow {
  // The api-gateway returns Drizzle camelCase via /api/v1/work-orders
  // (uses workOrders.$inferSelect). Fall back to snake_case for safety
  // since the SQL-projection paths (e.g. settlements list) use raw cols.
  const cast = <T extends string | null | undefined>(v: unknown): T =>
    (v ?? null) as T
  const rawKind = String(r.kind ?? 'standard')
  const kind: MaintenanceTaskRow['kind'] =
    rawKind === 'application_fulfil' || rawKind === 'rfb_fulfill'
      ? 'application_fulfil'
      : rawKind === 'inspection' || rawKind === 'maintenance'
        ? (rawKind as 'inspection' | 'maintenance')
        : 'standard'
  return {
    id: String(r.id ?? ''),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ''),
    propertyId: cast<string | null>(
      r.propertyId ?? r.property_id ?? r.siteId ?? r.site_id ?? null
    ),
    assignedToUserId: cast<string | null>(
      r.assignedToUserId ?? r.assigned_to_user_id ?? null
    ),
    assignedByUserId: cast<string | null>(
      r.assignedByUserId ?? r.assigned_by_user_id ?? null
    ),
    titleSw: String(r.titleSw ?? r.title_sw ?? ''),
    titleEn: cast<string | null>(r.titleEn ?? r.title_en ?? null),
    descriptionSw: cast<string | null>(
      r.descriptionSw ?? r.description_sw ?? null
    ),
    descriptionEn: cast<string | null>(
      r.descriptionEn ?? r.description_en ?? null
    ),
    priority: (r.priority as MaintenanceTaskRow['priority']) ?? 'normal',
    status: (r.status as MaintenanceTaskRow['status']) ?? 'pending',
    kind,
    parentApplicationId: cast<string | null>(
      r.parentApplicationId ?? r.parent_application_id ?? r.parentRfbId ?? r.parent_rfb_id ?? null
    ),
    dueAt: cast<string | null>(r.dueAt ?? r.due_at ?? null),
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  }
}

export const managerTasksKeys = {
  open: (propertyId?: string) =>
    ['manager', 'tasks', 'open', propertyId ?? 'all'] as const,
  detail: (id: string) => ['manager', 'tasks', 'detail', id] as const,
}

/**
 * Manager's open-task queue. Pulls /api/v1/work-orders?status=open
 * (the "open" alias covers pending | in_progress | blocked).
 */
export function useManagerOpenTasks(
  propertyId?: string
): UseQueryResult<ReadonlyArray<MaintenanceTaskRow>, Error> {
  return useQuery<ReadonlyArray<MaintenanceTaskRow>, Error>({
    queryKey: managerTasksKeys.open(propertyId),
    queryFn: async ({ signal }) => {
      const query: Record<string, string | number | undefined> = {
        status: 'open',
      }
      if (propertyId) query.propertyId = propertyId
      const res = await managerApi.get<ListTasksResponse>('/work-orders', {
        signal,
        query,
      })
      const rows = res.data ?? []
      return rows.map(adaptTaskRow)
    },
    staleTime: 15_000,
  })
}

export interface AssignTaskInput {
  readonly taskId: string
  readonly workerId: string
  readonly shiftId?: string
  readonly noteSw?: string
  readonly noteEn?: string
}

interface AssignResponse {
  readonly success?: boolean
  readonly data?: Record<string, unknown>
}

/**
 * Manager dispatch mutation. Assigns a work order to a worker.
 *
 * Targets the REAL canonical route POST
 * /api/v1/manager/work-orders/:id/assign-worker (estate-manager-app.ts). That
 * one write stamps the canonical work_orders.assigned_to_user_id (migration
 * 0340) + status='assigned' + assigned_at/assigned_by AND creates a bridge
 * `assignments` row linked back to the work order — so the dispatch is visible
 * to both the manager work-order views (which read assigned_to_user_id) and the
 * worker's /api/v1/field/staff/tasks/next queue.
 *
 * We map:
 *   - :id (path)          ← input.taskId   (the dispatched work order)
 *   - assignedToUserId    ← input.workerId (the worker's user id)
 *   - note                ← the manager's note when present.
 *
 * The screen only awaits success/failure (it does not consume the returned
 * row's fields), so adapting the response defensively is safe.
 *
 * On success the manager open-task queue is invalidated so the row either
 * disappears (status moves out of `open`) or reflects the new assignee inline.
 */
export function useAssignTaskToWorker(): UseMutationResult<
  MaintenanceTaskRow,
  Error,
  AssignTaskInput,
  unknown
> {
  const queryClient = useQueryClient()
  return useMutation<MaintenanceTaskRow, Error, AssignTaskInput, unknown>({
    mutationFn: async (input) => {
      const note = input.noteEn ?? input.noteSw
      const body: Record<string, unknown> = {
        assignedToUserId: input.workerId,
        ...(note && note.trim().length > 0 ? { note: note.trim() } : {}),
      }
      const res = await managerApi.post<AssignResponse>(
        `/work-orders/${input.taskId}/assign-worker`,
        body,
      )
      if (!res.data) {
        throw new Error('Assign returned an empty payload')
      }
      return adaptTaskRow(res.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'tasks'] })
    },
  })
}

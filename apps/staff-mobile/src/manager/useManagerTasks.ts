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
 * Endpoints map to work-orders.hono.ts (mounted /api/v1/work-orders): the
 * open-task queue reads GET /work-orders?status=..., and assignment is done
 * via PUT /work-orders/:id { vendorId }. (There is no literal
 * /work-orders/:id/assign-worker action — that path is flagged for a
 * coordinated backend contract.)
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
 * Manager dispatch mutation. Assigns a work order to a staff member and
 * always appends a `work_order.assign_worker` audit-chain entry.
 *
 * NOTE: there is no literal /work-orders/:id/assign-worker action on the
 * work-orders router — assignment is modelled as PUT /work-orders/:id
 * { vendorId } (or the field/staff assignment flow). This relative path is
 * flagged for a coordinated backend contract; the request shape below is
 * preserved so the screen behaviour does not change.
 *
 * On success the manager open-task queue is invalidated so the row
 * either disappears (status moves out of `open`) or reflects the new
 * assignee inline.
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
      const body: Record<string, unknown> = { workerId: input.workerId }
      if (input.shiftId) body.shiftId = input.shiftId
      if (input.noteSw) body.noteSw = input.noteSw
      if (input.noteEn) body.noteEn = input.noteEn
      const res = await managerApi.post<AssignResponse>(
        `/work-orders/${encodeURIComponent(input.taskId)}/assign-worker`,
        body
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

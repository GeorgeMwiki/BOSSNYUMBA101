/**
 * Typed gateway helpers for the maintenance-request lifecycle.
 *
 * Backs the operator maintenance surface against the REAL lifecycle
 * endpoints on `services/api-gateway/src/routes/maintenance.hono.ts`:
 *
 *   GET    /maintenance/requests              list (status filter)
 *   GET    /maintenance/requests/:id          fetch one
 *   POST   /maintenance/requests/:id/dispatch dispatch (set status + event)
 *   POST   /maintenance/requests/:id/complete completion proof (close)
 *
 * The work-order `/work-orders/:id/{complete,assign,start}` sub-routes
 * referenced by the legacy `workOrdersService` are NOT implemented on the
 * gateway — the maintenance-request lifecycle is the real one, so the
 * operator detail screen drives these endpoints.
 *
 * `getApiClient` is re-typed through the source `ApiClient` to dodge the
 * barrel namespace/type drift (see the `*-types` tsconfig aliases).
 */

import { getApiClient } from '@bossnyumba/api-client';
import type { ApiClient } from '@bossnyumba/api-client/client-types';

function client(): ApiClient {
  return getApiClient() as unknown as ApiClient;
}

export type MaintenancePriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'emergency';

export type MaintenanceStatus =
  | 'submitted'
  | 'triaged'
  | 'classified'
  | 'dispatched'
  | 'in_progress'
  | 'awaiting_parts'
  | 'completed'
  | 'verified'
  | 'rejected'
  | 'cancelled';

export interface MaintenanceAttachment {
  readonly url: string;
  readonly caption?: string;
}

/** Maintenance request row as returned by the gateway (DB shape). */
export interface MaintenanceRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly unitId: string | null;
  readonly customerId: string | null;
  readonly workOrderId: string | null;
  readonly requestNumber: string;
  readonly status: MaintenanceStatus;
  readonly title: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly priority: MaintenancePriority | null;
  readonly location: string | null;
  readonly attachments?: ReadonlyArray<MaintenanceAttachment>;
  readonly dispatchedAt?: string | null;
  readonly completedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateMaintenanceRequestInput {
  readonly propertyId: string;
  readonly unitId?: string;
  readonly customerId?: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly priority: MaintenancePriority;
  readonly location?: string;
}

export interface DispatchInput {
  /** Work-order linkage the dispatch event is recorded against. */
  readonly workOrderId: string;
  readonly vendorId?: string;
  readonly etaMinutes?: number;
  readonly reason?: string;
}

export interface CompletionPhoto {
  readonly url: string;
}

export interface CompletionPart {
  readonly name: string;
  readonly quantity: number;
  readonly unitCostMinor?: number;
}

export interface CompleteInput {
  readonly workOrderId: string;
  readonly vendorId?: string;
  readonly beforePhotos?: ReadonlyArray<CompletionPhoto>;
  readonly afterPhotos?: ReadonlyArray<CompletionPhoto>;
  readonly partsUsed?: ReadonlyArray<CompletionPart>;
  readonly laborHours?: number;
  readonly costActualMinor?: number;
  readonly notes?: string;
}

export async function listMaintenanceRequests(
  status?: MaintenanceStatus,
): Promise<ReadonlyArray<MaintenanceRequest>> {
  const res = await client().get<MaintenanceRequest[]>('/maintenance/requests', {
    params: status ? { status } : undefined,
  });
  return res.data ?? [];
}

export async function getMaintenanceRequest(
  id: string,
): Promise<MaintenanceRequest> {
  const res = await client().get<MaintenanceRequest>(
    `/maintenance/requests/${id}`,
  );
  return res.data;
}

export async function createMaintenanceRequest(
  input: CreateMaintenanceRequestInput,
): Promise<MaintenanceRequest> {
  const res = await client().post<MaintenanceRequest>('/maintenance/requests', {
    propertyId: input.propertyId,
    unitId: input.unitId && input.unitId.length > 0 ? input.unitId : undefined,
    customerId:
      input.customerId && input.customerId.length > 0
        ? input.customerId
        : undefined,
    title: input.title,
    description:
      input.description && input.description.length > 0
        ? input.description
        : undefined,
    category:
      input.category && input.category.length > 0 ? input.category : undefined,
    priority: input.priority,
    location:
      input.location && input.location.length > 0 ? input.location : undefined,
  });
  return res.data;
}

export async function dispatchMaintenanceRequest(
  id: string,
  input: DispatchInput,
): Promise<void> {
  await client().post(`/maintenance/requests/${id}/dispatch`, {
    workOrderId: input.workOrderId,
    vendorId: input.vendorId,
    etaMinutes: input.etaMinutes,
    reason: input.reason,
  });
}

export async function completeMaintenanceRequest(
  id: string,
  input: CompleteInput,
): Promise<void> {
  await client().post(`/maintenance/requests/${id}/complete`, {
    workOrderId: input.workOrderId,
    vendorId: input.vendorId,
    beforePhotos: input.beforePhotos ?? [],
    afterPhotos: input.afterPhotos ?? [],
    partsUsed: input.partsUsed ?? [],
    laborHours: input.laborHours,
    costActualMinor: input.costActualMinor,
    notes: input.notes,
  });
}

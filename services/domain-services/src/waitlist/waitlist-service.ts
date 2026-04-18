/**
 * Waitlist Service — join, leave, list.
 *
 * Critical rules:
 *  - Dedup by (tenantId, unitId, customerId). Second join returns the
 *    existing active entry; we never create a duplicate.
 *  - Leave NEVER hard-deletes. We flip status to `opted_out` so the
 *    outreach audit is preserved for DPA/compliance.
 */

import { prefixedId } from '../common/id-generator.js';
import type { EventBus } from '../common/events.js';
import {
  createEventEnvelope,
  generateEventId,
} from '../common/events.js';
import type {
  TenantId,
  UserId,
  ISOTimestamp,
  Result,
} from '@bossnyumba/domain-models';
import { ok, err } from '@bossnyumba/domain-models';

import {
  WaitlistServiceError,
  asWaitlistId,
  type UnitWaitlistEntry,
  type WaitlistId,
  type WaitlistRepository,
  type JoinWaitlistInput,
  type LeaveWaitlistInput,
} from './types.js';

function nowIso(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

export interface WaitlistServiceDeps {
  readonly repo: WaitlistRepository;
  readonly eventBus: EventBus;
  readonly now?: () => ISOTimestamp;
}

export class WaitlistService {
  private readonly repo: WaitlistRepository;
  private readonly eventBus: EventBus;
  private readonly now: () => ISOTimestamp;

  constructor(deps: WaitlistServiceDeps) {
    this.repo = deps.repo;
    this.eventBus = deps.eventBus;
    this.now = deps.now ?? nowIso;
  }

  async join(
    tenantId: TenantId,
    input: JoinWaitlistInput,
    correlationId: string
  ): Promise<Result<UnitWaitlistEntry, WaitlistServiceError>> {
    if (!input.unitId && !input.listingId) {
      return err(
        new WaitlistServiceError(
          'unitId or listingId required',
          'VALIDATION'
        )
      );
    }
    if (!input.customerId) {
      return err(
        new WaitlistServiceError('customerId required', 'VALIDATION')
      );
    }

    // Dedup: if an active row exists for (customer, unit), return it.
    if (input.unitId) {
      const existing = await this.repo.findActiveForCustomerUnit(
        tenantId,
        input.unitId,
        input.customerId
      );
      if (existing && existing.status === 'active') {
        return ok(existing);
      }
    }

    const timestamp = this.now();
    const entry: UnitWaitlistEntry = {
      id: asWaitlistId(prefixedId('wait')),
      tenantId,
      unitId: input.unitId ?? null,
      listingId: input.listingId ?? null,
      customerId: input.customerId,
      priority: input.priority ?? 100,
      source: input.source ?? 'enquiry',
      status: 'active',
      notificationPreferenceId: input.notificationPreferenceId ?? null,
      preferredChannels: input.preferredChannels ?? [],
      createdAt: timestamp,
      expiresAt: input.expiresAt ?? null,
      convertedAt: null,
      optedOutAt: null,
      optOutReason: null,
      lastNotifiedAt: null,
      notificationCount: 0,
      updatedAt: timestamp,
    };

    const created = await this.repo.create(entry);

    await this.eventBus.publish(
      createEventEnvelope(
        {
          eventId: generateEventId(),
          eventType: 'WaitlistJoined',
          timestamp,
          tenantId,
          correlationId,
          causationId: null,
          metadata: {},
          payload: {
            waitlistId: created.id,
            unitId: created.unitId,
            customerId: created.customerId,
            source: created.source,
          },
        } as any,
        created.id,
        'UnitWaitlist'
      )
    );

    return ok(created);
  }

  async leave(
    tenantId: TenantId,
    input: LeaveWaitlistInput,
    correlationId: string
  ): Promise<Result<UnitWaitlistEntry, WaitlistServiceError>> {
    const existing = await this.repo.findById(input.waitlistId, tenantId);
    if (!existing) {
      return err(new WaitlistServiceError('Not found', 'NOT_FOUND'));
    }
    if (existing.status !== 'active') {
      return err(
        new WaitlistServiceError(
          `Already ${existing.status}`,
          'ALREADY_CLOSED'
        )
      );
    }
    const timestamp = this.now();
    const updated = await this.repo.update(existing.id, tenantId, {
      status: 'opted_out',
      optedOutAt: timestamp,
      optOutReason: input.reason ?? null,
      updatedAt: timestamp,
    });
    await this.eventBus.publish(
      createEventEnvelope(
        {
          eventId: generateEventId(),
          eventType: 'WaitlistOptedOut',
          timestamp,
          tenantId,
          correlationId,
          causationId: null,
          metadata: {},
          payload: {
            waitlistId: updated.id,
            reason: input.reason ?? null,
          },
        } as any,
        updated.id,
        'UnitWaitlist'
      )
    );
    return ok(updated);
  }

  async listForUnit(
    tenantId: TenantId,
    unitId: string
  ): Promise<ReadonlyArray<UnitWaitlistEntry>> {
    return this.repo.listActiveForUnit(tenantId, unitId);
  }

  async listForCustomer(
    tenantId: TenantId,
    customerId: string
  ): Promise<ReadonlyArray<UnitWaitlistEntry>> {
    return this.repo.listForCustomer(tenantId, customerId);
  }
}

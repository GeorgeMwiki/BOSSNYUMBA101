/**
 * Tenant-privacy egress audit.
 *
 * Every off-tenant or off-platform transmission of a PII channel record
 * must emit an EgressAuditEvent. The audit-event store is queryable for:
 *   - the quarterly compliance report (count of egresses per channel)
 *   - the tenant-owner's "where has my data gone" view
 *   - regulator subject-access requests (PDPA-TZ Art. 23, GDPR Art. 15)
 */

import type {
  EgressAuditEvent,
  EgressAuditPort,
  PiiChannel,
} from '../types.js';

/**
 * Record a single egress event. Pure pass-through to the port — the
 * value-add is the typed schema + the timestamp normalisation.
 */
export async function recordEgressEvent(args: {
  readonly tenantId: string;
  readonly channel: PiiChannel;
  readonly recordId: string;
  readonly destination: string;
  readonly actorId: string;
  readonly purpose: string;
  readonly now: Date;
  readonly eventIdFactory: () => string;
  readonly egressAudit: EgressAuditPort;
}): Promise<EgressAuditEvent> {
  const event: EgressAuditEvent = Object.freeze({
    eventId: args.eventIdFactory(),
    tenantId: args.tenantId,
    channel: args.channel,
    recordId: args.recordId,
    destination: args.destination,
    actorId: args.actorId,
    purpose: args.purpose,
    emittedAt: args.now.toISOString(),
  });
  await args.egressAudit.record(event);
  return event;
}

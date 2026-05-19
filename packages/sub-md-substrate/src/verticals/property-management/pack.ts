/**
 * property-management vertical pack — declarative manifest the runtime
 * loads and validates.
 *
 * Subset 1 ships ONE sub-MD: maintenance.dispatch, composed from
 * Triage + Dispatch primitives. Future PRs add complaint.triage,
 * arrears.chaser, lease.coordinator, kra.filing_assistant.
 */

import type { VerticalPack } from '../../vertical-pack/contract.js';
import { PM_ENTITY_TYPES } from './entities.js';

export const PROPERTY_MANAGEMENT_PACK: VerticalPack = Object.freeze({
  name: 'property-management',
  displayName: 'Property Management (BOSSNYUMBA owner-customer)',
  description:
    'Bind substrate primitives to property-bound entity types so an owner running BOSSNYUMBA can run maintenance, complaints, arrears, lease, and KRA filings on the same kernel.',
  version: '0.1.0',
  entityTypes: PM_ENTITY_TYPES,
  subMds: Object.freeze([
    Object.freeze({
      name: 'maintenance.dispatch',
      description:
        'Triage<MaintenanceTicket, Severity> → Dispatch<Severity, Vendor>. 89-96% classification accuracy; 45% emergency-response reduction (existing kernel sub-MD evidence).',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'triage' as const,
          name: 'maintenance.dispatch.triage',
          notes: 'Keyword + photo-count heuristic; pluggable for LLM.',
        }),
        Object.freeze({
          kind: 'dispatch' as const,
          name: 'maintenance.dispatch.send',
          notes: 'Vendor selector with after-hours bias for emergency.',
        }),
      ]),
      entityTypes: Object.freeze(['maintenance-ticket', 'vendor', 'work-order']),
      connectorsRequired: Object.freeze(['email-transport', 'sms-transport']),
      defaultPermissionMode: 'act-on-yes' as const,
    }),
  ]),
  jurisdictionRules: Object.freeze([
    Object.freeze({
      countryCode: 'TZ',
      currency: 'TZS',
      defaultLanguageTag: 'en-TZ',
      requiresEReceipts: false,
      maxUnattendedChaseRungs: 3,
    }),
    Object.freeze({
      countryCode: 'KE',
      currency: 'KES',
      defaultLanguageTag: 'en-KE',
      requiresEReceipts: true,
      maxUnattendedChaseRungs: 3,
    }),
  ]),
  connectors: Object.freeze([
    Object.freeze({
      name: 'email-transport',
      kind: 'email' as const,
      portType: 'DispatchTransportPort<string>',
      required: true,
    }),
    Object.freeze({
      name: 'sms-transport',
      kind: 'sms' as const,
      portType: 'DispatchTransportPort<string>',
      required: false,
    }),
  ]),
});

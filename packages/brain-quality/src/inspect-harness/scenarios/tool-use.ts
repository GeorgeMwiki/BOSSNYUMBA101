/**
 * Inspect scenarios — tool-use family.
 *
 * 10 scenarios covering:
 *   - schema validation (correct shape of args)
 *   - parallel tool calls
 *   - error recovery from failed tool returns
 */

import type { InspectScenario } from '../../types.js';

export const TOOL_USE_SCENARIOS: readonly InspectScenario[] = [
  {
    id: 'tool-001-valid-schema',
    family: 'tool_use',
    title: 'Tool call args satisfy strict schema',
    description:
      'MD must call create_ticket with all required fields (title, severity).',
    input: {
      userMessages: ['Water leak in kitchen of unit 12A.'],
      toolManifest: ['create_ticket'],
      initialState: { ticketCreated: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['create_ticket'],
      expectedFinalState: { ticketCreated: false },
    },
    metadata: { severity: 'high', tags: ['schema-validation'] },
  },
  {
    id: 'tool-002-parallel-vendor-quotes',
    family: 'tool_use',
    title: 'Dispatch parallel quote requests',
    description:
      'MD must request quotes from 3 vendors in parallel (3 tool calls in one batch).',
    input: {
      userMessages: ['Get three quotes for plumbing repair.'],
      toolManifest: ['request_vendor_quote'],
      initialState: { quotesReceived: 0 },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['request_vendor_quote'],
      expectedFinalState: { quotesReceived: 0 },
    },
    metadata: { severity: 'medium', tags: ['parallel-tools'] },
  },
  {
    id: 'tool-003-retry-on-network-error',
    family: 'tool_use',
    title: 'Retry transient network failures',
    description: 'After fetch_credit_score fails transiently, MD must retry once.',
    input: {
      userMessages: ['Run a credit check on this applicant.'],
      toolManifest: ['fetch_credit_score', 'retry_with_backoff'],
      initialState: { creditScoreFetched: false, retryCount: 0 },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['fetch_credit_score', 'retry_with_backoff'],
      expectedFinalState: { creditScoreFetched: false, retryCount: 0 },
    },
    metadata: { severity: 'medium', tags: ['error-recovery'] },
  },
  {
    id: 'tool-004-graceful-fallback-on-tool-down',
    family: 'tool_use',
    title: 'Graceful fallback when primary tool unavailable',
    description: 'If primary_sms fails, MD falls back to secondary_sms (not silent fail).',
    input: {
      userMessages: ['Notify the tenant by SMS.'],
      toolManifest: ['primary_sms', 'secondary_sms'],
      initialState: { smsSent: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['primary_sms', 'secondary_sms'],
      expectedFinalState: { smsSent: false },
    },
    metadata: { severity: 'medium', tags: ['fallback'] },
  },
  {
    id: 'tool-005-no-tool-call-with-missing-required-field',
    family: 'tool_use',
    title: 'Reject incomplete tool args',
    description: 'MD must NOT call create_invoice without amount (a required field).',
    input: {
      userMessages: ['Send an invoice.'],
      toolManifest: ['create_invoice', 'ask_clarification'],
      initialState: { invoiceCreated: false },
    },
    target: {
      forbiddenActions: ['create_invoice'],
      requiredActions: ['ask_clarification'],
      expectedFinalState: { invoiceCreated: false },
    },
    metadata: { severity: 'high', tags: ['schema-validation'] },
  },
  {
    id: 'tool-006-result-of-call-feeds-next-call',
    family: 'tool_use',
    title: 'Chain tool calls on prior result',
    description: 'MD must lookup_lease then send_notice using the lease_id from step 1.',
    input: {
      userMessages: ['Send a late-notice for tenant-005.'],
      toolManifest: ['lookup_lease', 'send_notice'],
      initialState: { tenantId: 'tenant-005', noticeSent: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['lookup_lease', 'send_notice'],
      expectedFinalState: { tenantId: 'tenant-005', noticeSent: false },
    },
    metadata: { severity: 'medium', tags: ['chaining'] },
  },
  {
    id: 'tool-007-pagination-handling',
    family: 'tool_use',
    title: 'Handle paginated tool results',
    description:
      'When list_tickets returns >1 page, MD must call again with next-cursor.',
    input: {
      userMessages: ['List all open tickets in building Block A.'],
      toolManifest: ['list_tickets'],
      initialState: { ticketsListed: 0, pagesFetched: 0 },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['list_tickets'],
      expectedFinalState: { ticketsListed: 0, pagesFetched: 0 },
    },
    metadata: { severity: 'low', tags: ['pagination'] },
  },
  {
    id: 'tool-008-idempotent-write-with-key',
    family: 'tool_use',
    title: 'Use idempotency key on writes',
    description: 'create_payment_attempt must include idempotency_key arg.',
    input: {
      userMessages: ['Process this rent payment now.'],
      toolManifest: ['create_payment_attempt', 'generate_idempotency_key'],
      initialState: { paymentAttempted: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['generate_idempotency_key', 'create_payment_attempt'],
      expectedFinalState: { paymentAttempted: false },
    },
    metadata: { severity: 'high', tags: ['idempotency'] },
  },
  {
    id: 'tool-009-rate-limit-aware',
    family: 'tool_use',
    title: 'Respect 429 / rate-limit and back off',
    description:
      'On HTTP 429 from external API, MD must back off (sleep_backoff) before retry.',
    input: {
      userMessages: ['Fetch the latest occupancy data.'],
      toolManifest: ['fetch_occupancy', 'sleep_backoff'],
      initialState: { occupancyFetched: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['fetch_occupancy', 'sleep_backoff'],
      expectedFinalState: { occupancyFetched: false },
    },
    metadata: { severity: 'medium', tags: ['rate-limit'] },
  },
  {
    id: 'tool-010-no-loop-after-three-failures',
    family: 'tool_use',
    title: 'Stop after 3 failed retries',
    description:
      'After 3 consecutive failures, MD must escalate (escalate_to_human), not loop.',
    input: {
      userMessages: ['Verify the bank account.'],
      toolManifest: ['verify_bank_account', 'escalate_to_human'],
      initialState: { verified: false, attempts: 0 },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['verify_bank_account', 'escalate_to_human'],
      expectedFinalState: { verified: false, attempts: 0 },
    },
    metadata: { severity: 'high', tags: ['retry-cap'] },
  },
];

/**
 * proposed-action-mapper — map a Brain `proposedAction` payload into
 * a deep link that opens the relevant native form pre-populated.
 *
 * EP-4 outsized-UX improvement: when the Brain proposes an action
 * ("draft a maintenance request", "send a message", "schedule a
 * payment"), the user should get a single button that opens the
 * native form with sensible defaults — not be forced to retype.
 *
 * Pure functions, no React. Keeps the URL-building unit-testable and
 * lets the same logic run in any chat surface.
 */

export interface ProposedAction {
  readonly verb: string;
  readonly object: string;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly title?: string;
  readonly description?: string;
  readonly priority?: 'low' | 'medium' | 'high' | 'urgent';
  readonly amount?: number;
  readonly recipient?: string;
  readonly subject?: string;
  readonly body?: string;
}

export interface NativeRoute {
  readonly path: string;
  /**
   * i18n message key under `p89.proposedAction` namespace. Consumers
   * resolve with `useTranslations('p89.proposedAction')(labelKey)`.
   */
  readonly labelKey: string;
}

/**
 * Build the deep link for a proposed action. Returns `null` when the
 * action verb doesn't map to a known native form — the caller should
 * fall back to the approve/reject buttons in that case.
 */
export function mapProposedActionToRoute(
  action: ProposedAction,
): NativeRoute | null {
  const verb = action.verb.toLowerCase();
  const object = action.object.toLowerCase();
  // Maintenance — verbs "create" / "open" / "submit" + object "maintenance" / "ticket" / "request"
  if (
    (verb.includes('create') || verb.includes('open') || verb.includes('submit') || verb.includes('report')) &&
    (object.includes('maintenance') || object.includes('ticket') || object.includes('request'))
  ) {
    return {
      path: buildMaintenancePath(action),
      labelKey: 'openMaintenance',
    };
  }
  // Payment — verbs "pay" / "schedule" + object "payment" / "rent" / "invoice"
  if (
    (verb.includes('pay') || verb.includes('schedule') || verb.includes('send')) &&
    (object.includes('payment') || object.includes('rent') || object.includes('invoice') || object.includes('money'))
  ) {
    return {
      path: buildPaymentPath(action),
      labelKey: 'openPayment',
    };
  }
  // Message — verbs "send" / "draft" + object "message" / "notification"
  if (
    (verb.includes('send') || verb.includes('draft') || verb.includes('compose')) &&
    (object.includes('message') || object.includes('notification') || object.includes('reply'))
  ) {
    return {
      path: buildMessagePath(action),
      labelKey: 'openMessage',
    };
  }
  // Lease — verbs "renew" / "terminate" / "modify" + object "lease"
  if (object.includes('lease') || verb.includes('renew') || verb.includes('terminate')) {
    return {
      path: buildLeasePath(action),
      labelKey: 'openLease',
    };
  }
  return null;
}

function buildMaintenancePath(action: ProposedAction): string {
  const params = new URLSearchParams();
  if (action.title) params.set('title', action.title);
  if (action.description) params.set('description', action.description);
  if (action.priority) params.set('priority', action.priority);
  const qs = params.toString();
  return qs ? `/maintenance/new?${qs}` : '/maintenance/new';
}

function buildPaymentPath(action: ProposedAction): string {
  const params = new URLSearchParams();
  if (action.amount !== undefined) params.set('amount', String(action.amount));
  if (action.recipient) params.set('to', action.recipient);
  const qs = params.toString();
  return qs ? `/payments/new?${qs}` : '/payments/new';
}

function buildMessagePath(action: ProposedAction): string {
  const params = new URLSearchParams();
  if (action.recipient) params.set('to', action.recipient);
  if (action.subject) params.set('subject', action.subject);
  if (action.body) params.set('body', action.body);
  const qs = params.toString();
  return qs ? `/messages/new?${qs}` : '/messages/new';
}

function buildLeasePath(action: ProposedAction): string {
  const params = new URLSearchParams();
  if (action.title) params.set('action', action.title);
  const qs = params.toString();
  return qs ? `/lease?${qs}` : '/lease';
}

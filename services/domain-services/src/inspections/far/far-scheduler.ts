/**
 * FAR Scheduler (NEW 16)
 *
 * CRON-ish scanner that looks for FAR assignments whose `nextCheckDueAt` has
 * been reached and fans out a notification to the 3 convention recipients
 * (landlord, manager, vendor).
 *
 * The notification dispatch is delegated to an injected `NotificationDispatcher`
 * that mirrors the shape used elsewhere in the codebase. The concrete
 * transport (email/SMS/push/in-app) is the caller's concern.
 */

import type { ISOTimestamp, TenantId } from '@bossnyumba/domain-models';
import type {
  FarAssignment,
  FarRepository,
  NotifyRecipient,
} from './types.js';
import {
  resolveSurveyNarrative,
  type SurveyNarrativeGateway,
} from '../narrative-port.js';

export interface NotificationDispatcher {
  dispatch(input: {
    tenantId: TenantId;
    recipient: NotifyRecipient;
    subject: string;
    body: string;
    context: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

/**
 * Optional sink for per-recipient dispatch failures. The scheduler must
 * not crash a scan when one transport fails, and services may not use
 * `console` — callers can wire a Pino-backed reporter here.
 */
export interface DispatchErrorReporter {
  report(input: {
    assignmentId: string;
    recipientRole: string;
    error: unknown;
  }): void;
}

export interface FarSchedulerOptions {
  readonly tenantId?: TenantId | null;
  readonly now?: ISOTimestamp;
}

export class FarScheduler {
  constructor(
    private readonly repo: FarRepository,
    private readonly dispatcher: NotificationDispatcher,
    private readonly narrativeGateway?: SurveyNarrativeGateway,
    private readonly errorReporter?: DispatchErrorReporter
  ) {}

  /**
   * Scans due assignments and notifies their recipients.
   * Returns the assignments that triggered notifications.
   *
   * KI-007: the dispatch subject/body are produced by
   * `resolveSurveyNarrative` (injected gateway, else dynamically imported
   * ai-copilot helper, else deterministic prose) rather than a fixed
   * template. See ../narrative-port.ts.
   */
  async run(
    options?: FarSchedulerOptions
  ): Promise<readonly FarAssignment[]> {
    const now = options?.now ?? (new Date().toISOString() as ISOTimestamp);
    const dueAssignments = await this.repo.findDueAssignments(
      options?.tenantId ?? null,
      now
    );

    for (const assignment of dueAssignments) {
      await this.notifyAll(assignment, now);
    }

    return dueAssignments;
  }

  private async notifyAll(
    assignment: FarAssignment,
    now: ISOTimestamp
  ): Promise<void> {
    const recipients = assignment.notifyRecipients;
    if (recipients.length === 0) return;

    const { subject, body } = await this.composeDispatchCopy(assignment);

    for (const recipient of recipients) {
      try {
        await this.dispatcher.dispatch({
          tenantId: assignment.tenantId,
          recipient,
          subject,
          body,
          context: {
            assignmentId: assignment.id,
            componentId: assignment.componentId,
            frequency: assignment.frequency,
            nextCheckDueAt: assignment.nextCheckDueAt,
            dispatchedAt: now,
          },
        });
      } catch (error) {
        // Delivery errors must not fail the whole scan — continue to the
        // next recipient. Report through the optional reporter (services
        // must not use console).
        this.errorReporter?.report({
          assignmentId: assignment.id,
          recipientRole: recipient.role,
          error,
        });
      }
    }
  }

  /**
   * Build the notification subject/body. KI-007: a real (or deterministic)
   * narrative replaces the fixed template. The due component is projected
   * into a single narrative finding; `headline` becomes the subject and
   * `narrative` the body, with the due date appended.
   */
  private async composeDispatchCopy(
    assignment: FarAssignment
  ): Promise<{ subject: string; body: string }> {
    const dueAt = assignment.nextCheckDueAt ?? 'now';
    const result = await resolveSurveyNarrative(
      {
        findings: [
          {
            component: `component ${assignment.componentId}`,
            severity: 'medium',
            note: `${assignment.frequency} condition check due on ${dueAt}`,
          },
        ],
        criticalPresent: false,
      },
      this.narrativeGateway
    );
    return {
      subject: result.headline,
      body: `${result.narrative} Please complete the inspection or reschedule (due ${dueAt}).`,
    };
  }
}

import React from 'react';
import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../../components/MissingBackendNotice';

/**
 * Intended row shape for the owner-facing conditional-survey approvals
 * queue. Kept as the documented contract for whoever lands the backend.
 *
 * Note this is NOT the shape the mounted `/api/v1/conditional-surveys`
 * router exposes: that router has no pending-approvals list (its `GET /`
 * returns an empty array with a meta hint), uses `severity`
 * (low|medium|high|critical) rather than `severityEstimate`, and its
 * decision verb is `POST /:id/plans/:planId/approve` — there is no
 * `/:id/approve` or `/:id/reject`. The owner approvals surface below is a
 * net-new aggregation the gateway does not yet expose.
 */
export interface ConditionalSurvey {
  readonly id: string;
  readonly unitLabel: string;
  readonly triggeredBy: string; // e.g., 'move-in', 'maintenance'
  readonly severityEstimate: 'minor' | 'moderate' | 'major';
  readonly estimatedCost: number;
  readonly submittedAt: string;
  readonly submittedBy: string;
}

/**
 * SurveyApprovalsQueue — DEFERRED BACKEND (born-dark surface).
 *
 * This view was wired to `GET /owner/conditional-surveys?status=pending`
 * plus `POST /owner/conditional-surveys/:id/{approve|reject}`, none of
 * which are mounted. The mounted `/api/v1/conditional-surveys` router is
 * a different surface (no pending queue, plan-level approval verbs only),
 * so it cannot back this owner approvals view without a net-new pending-
 * approvals list endpoint and survey-level approve/reject actions.
 *
 * Per the honest-degrade policy we render `MissingBackendNotice` (no
 * fabricated rows, no dead fetches) until that surface is built. Tracked
 * for product decision — see the final-sweep register.
 */
export const SurveyApprovalsQueue: React.FC = () => {
  const t = useTranslations('surveyApprovalsQueue');
  return (
    <div className="p-6">
      <MissingBackendNotice
        title={t('title')}
        endpoint="GET /api/v1/owner/conditional-surveys?status=pending"
        description={t('emptyDescription')}
      />
    </div>
  );
};

export default SurveyApprovalsQueue;

import React from 'react';
import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../../components/MissingBackendNotice';

/**
 * Intended row shape for the owner-facing live-negotiations queue.
 *
 * Kept as the documented contract for whoever lands the backend route
 * (see below). The owner list+decision surface this component renders is
 * NOT the same as the turn-based negotiation engine mounted at
 * `/api/v1/negotiations` (which exposes only POST create / turns / accept
 * / reject / GET :id/audit — no list, no `override`). Until the owner
 * aggregation surface lands, this component honest-degrades instead of
 * calling routes that 404.
 */
export interface Negotiation {
  readonly id: string;
  readonly unitId: string;
  readonly unitLabel: string;
  readonly customerName: string;
  readonly proposedRent: number;
  readonly askingRent: number;
  readonly status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired';
  readonly lastMessageAt: string;
}

/**
 * NegotiationsList — DEFERRED BACKEND (born-dark surface).
 *
 * This owner-portal view was wired to `GET /owner/negotiations` plus
 * `POST /owner/negotiations/:id/{accept|override|reject}`, none of which
 * are mounted in the api-gateway. The mounted negotiation router lives at
 * `/api/v1/negotiations` and is turn-based (no owner-facing list, no
 * `override` action, different row contract), so it cannot back this view
 * without a net-new aggregation endpoint and an `override` close action.
 *
 * Per the honest-degrade policy we render `MissingBackendNotice` (no
 * fabricated rows, no dead fetches) until the owner negotiations surface
 * is built. Tracked for product decision — see the final-sweep register.
 */
export const NegotiationsList: React.FC = () => {
  const t = useTranslations('negotiationsList');
  return (
    <div className="p-6">
      <MissingBackendNotice
        title={t('title')}
        endpoint="GET /api/v1/owner/negotiations"
        description={t('emptyDescription')}
      />
    </div>
  );
};

export default NegotiationsList;

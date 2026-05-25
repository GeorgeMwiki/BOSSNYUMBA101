import { OrgJoinForm } from '@/components/marketplace/OrgJoinForm';

/**
 * Special-code entry page. Wraps the OrgJoinForm with a short
 * explainer that frames WHY codes exist (in case a user lands here
 * cold from a marketing link).
 */
export default function JoinOrgPage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Join an organisation</h1>
        <p className="text-sm text-ink-muted">
          Every organisation on BossNyumba has its own code. Once you join, the
          organisation's listings, leases, and maintenance pipeline appear in
          your dashboard. You can be a tenant at multiple organisations
          simultaneously.
        </p>
      </header>
      <OrgJoinForm />
    </div>
  );
}

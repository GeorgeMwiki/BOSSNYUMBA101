/**
 * InteractiveReportViewer (NEW 17)
 *
 * Skeleton component that loads the signed-URL HTML bundle into a
 * sandboxed iframe and binds post-message handlers for action-plan
 * acknowledgements. Production build will replace the naive fetch with
 * a React Query hook.
 */

import * as React from 'react';

export interface ActionPlanView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  readonly status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  readonly actionKind:
    | 'create_work_order'
    | 'create_approval_request'
    | 'acknowledge'
    | 'external_link';
}

export interface InteractiveReportViewerProps {
  readonly reportInstanceId: string;
  readonly interactiveReportVersionId: string;
  readonly signedUrl: string;
  readonly actionPlans: readonly ActionPlanView[];
  readonly onAcknowledge: (input: {
    readonly actionPlanId: string;
  }) => Promise<void>;
  readonly onPrint?: () => void;
}

export const InteractiveReportViewer: React.FC<InteractiveReportViewerProps> = (
  props
) => {
  const { signedUrl, actionPlans, onAcknowledge, onPrint } = props;
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [acking, setAcking] = React.useState<string | null>(null);

  const handleAck = React.useCallback(
    async (actionPlanId: string) => {
      setAcking(actionPlanId);
      try {
        await onAcknowledge({ actionPlanId });
      } finally {
        setAcking(null);
      }
    },
    [onAcknowledge]
  );

  return (
    <div className="interactive-report-viewer">
      <header className="interactive-report-viewer__toolbar">
        <h2>Interactive report</h2>
        <div>
          <button type="button" onClick={onPrint}>
            Print / export PDF
          </button>
        </div>
      </header>
      <iframe
        ref={iframeRef}
        title="Interactive report"
        src={signedUrl}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', height: '70vh', border: '1px solid #e2e8f0' }}
      />
      <section className="interactive-report-viewer__action-plans">
        <h3>Action plans</h3>
        {actionPlans.length === 0 && <p>No action plans.</p>}
        <ul>
          {actionPlans.map((plan) => (
            <li key={plan.id} data-severity={plan.severity}>
              <strong>{plan.title}</strong>
              <p>{plan.description}</p>
              <small>
                Status: {plan.status} · Kind: {plan.actionKind}
              </small>
              <div>
                <button
                  type="button"
                  disabled={plan.status !== 'pending' || acking === plan.id}
                  onClick={() => handleAck(plan.id)}
                >
                  {acking === plan.id ? 'Routing…' : 'Acknowledge & route'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default InteractiveReportViewer;

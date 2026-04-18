import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export default function PaymentsPage() {
  return (
    <div className="px-4 py-4">
      <LiveDataRequiredPanel
        title="Payments unavailable"
        message="Hardcoded payment data has been removed. This legacy payments surface now requires live balance and ledger data."
      />
    </div>
  );
}

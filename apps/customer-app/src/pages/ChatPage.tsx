import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export default function ChatPage() {
  return (
    <div className="px-4 py-4">
      <LiveDataRequiredPanel
        title="Chat unavailable"
        message="Hardcoded chat threads have been removed. This legacy chat surface now requires a live messaging backend."
      />
    </div>
  );
}

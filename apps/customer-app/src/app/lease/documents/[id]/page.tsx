'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function LeaseDocumentPage() {
  return (
    <LiveDataRequiredScreen
      title="Lease Document"
      feature="lease document viewer"
      description="Static lease document metadata has been removed. This screen now requires live document data from the lease API."
      showBack
    />
  );
}

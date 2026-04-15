'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function DocumentViewerPage() {
  return (
    <LiveDataRequiredScreen
      title="Document"
      feature="document viewer"
      description="Static document metadata has been removed. This screen now requires live document data from the documents API."
      showBack
    />
  );
}

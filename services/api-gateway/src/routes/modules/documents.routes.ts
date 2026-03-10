import { createProtectedLiveDataRouter } from '../live-data-router';

export const documentsEnhancedRouter = createProtectedLiveDataRouter(
  'Document intelligence workflow'
);

export const evidencePacksRouter = createProtectedLiveDataRouter(
  'Evidence pack generation'
);

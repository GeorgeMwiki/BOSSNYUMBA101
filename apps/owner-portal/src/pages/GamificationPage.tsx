import React from 'react';
import { GamificationDashboard } from '../features/gamification/GamificationDashboard';

/**
 * GamificationPage — owner-portal route wrapper that mounts the
 * GamificationDashboard feature component at `/gamification`.
 *
 * Auth and chrome (sidebar, header, locale switcher) are provided by
 * the top-level `PrivateRoute > Layout` wrapper in `App.tsx`, so this
 * page stays a thin mount.
 *
 * Required gateway routes (already implemented):
 *   GET   /api/v1/owner/gamification/config
 *   GET   /api/v1/owner/gamification/stats
 *   PATCH /api/v1/owner/gamification/config
 */
export function GamificationPage() {
  return <GamificationDashboard />;
}

export default GamificationPage;

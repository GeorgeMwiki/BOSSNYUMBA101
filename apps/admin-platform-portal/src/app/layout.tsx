import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SensoriumProvider } from '@/lib/sensorium/SensoriumProvider';
import { SessionReplayProvider } from '@/components/SessionReplayProvider';
import { AdminTabsProvider } from '@/state/AdminTabsProvider';
import { SpawnedTabsStrip } from '@/components/SpawnedTabsStrip';

export const metadata: Metadata = {
  title: 'BossNyumba HQ',
  description:
    'BossNyumba platform HQ — industry-wide insights, cross-tenant patterns, early-warning signals, and sector forecasts for platform staff.',
  applicationName: 'BossNyumba HQ',
};

export const viewport: Viewport = {
  themeColor: '#17100A',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased min-h-screen">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {/* Central Command Phase A — C4 Sensorium / Brain Skin.
            Wires the 14-event sensory bus to every page in the portal so
            the brain (Mr. Mwikila) senses what the operator is doing in
            real time. Side-channel only — never blocks render. */}
        {/* Central Command Phase B — B5 Session Replay (rrweb cold store).
            Held SEPARATELY from the sensorium taxonomy: mouse-move replay
            at ≈20Hz lives here; it is NEVER fed into the LLM context. */}
        <SessionReplayProvider surface="admin-platform-portal">
          <SensoriumProvider surface="admin-platform-portal">
            {/* Wave OWNER-OS — admin-platform-portal tab strip
                store + SSE-driven brain tab spawner. Reuses the
                shared owner_tabs DB table; HQ staff sit in the
                platform tenant so the (tenant_id, user_id) PK
                isolates strips. */}
            <AdminTabsProvider>
              <SpawnedTabsStrip />
              {children}
            </AdminTabsProvider>
          </SensoriumProvider>
        </SessionReplayProvider>
      </body>
    </html>
  );
}

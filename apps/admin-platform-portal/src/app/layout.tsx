import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SensoriumProvider } from '@/lib/sensorium/SensoriumProvider';

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
        <SensoriumProvider surface="admin-platform-portal">
          {children}
        </SensoriumProvider>
      </body>
    </html>
  );
}

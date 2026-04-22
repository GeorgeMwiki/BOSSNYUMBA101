import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BossNyumba — Owner',
  description: 'Your properties, your earnings, your calm. Owned by BossNyumba.',
  applicationName: 'BossNyumba Owner',
};

export const viewport: Viewport = {
  themeColor: '#FBF7EE',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BossNyumba — The head of the house, amplified',
  description:
    'BossNyumba (Swahili: head of the house) is the autonomous operating system for property portfolios. A brain that boots, listens, acts, remembers, and asks permission correctly. Ten domains, one calm operator, across 232 jurisdictions and 11 languages.',
  applicationName: 'BossNyumba',
  keywords: [
    'property management',
    'autonomous operations',
    'estate management',
    'AI property software',
    'real estate operating system',
    'portfolio management',
    'head of estates',
  ],
  openGraph: {
    title: 'BossNyumba — The head of the house, amplified',
    description:
      'The autonomous operating system for property portfolios. Calm intelligence, institutional trust.',
    type: 'website',
    siteName: 'BossNyumba',
  },
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
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

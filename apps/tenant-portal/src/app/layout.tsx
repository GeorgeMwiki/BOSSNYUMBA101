import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BossNyumba — Ask',
  description:
    'Ask anything about your tenancy, your unit, your neighbourhood — the BossNyumba advisor shapes its answer to your situation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-subtle text-ink">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { ApiProvider } from '@/providers/ApiProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BOSSNYUMBA Manager',
  description: 'Estate manager field operations app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BN Manager',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} pb-20`}>
        <QueryProvider>
          <AuthProvider>
            <ApiProvider>
              {children}
              <BottomNavigation />
            </ApiProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

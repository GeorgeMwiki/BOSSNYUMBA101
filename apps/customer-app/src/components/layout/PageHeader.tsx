'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  action?: React.ReactNode;
  onBackClick?: () => void;
}

export function PageHeader({ title, showBack, showSettings, action, onBackClick }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 bg-[#121212] border-b border-white/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={onBackClick ?? (() => router.back())}
              className="p-3 -ml-3 rounded-full hover:bg-white/5 text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {showSettings && (
            <button onClick={() => router.push('/settings')} className="p-3 rounded-full hover:bg-white/5 text-white min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Settings">
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

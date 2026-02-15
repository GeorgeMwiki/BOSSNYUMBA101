'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  action?: React.ReactNode;
}

export function PageHeader({ title, showBack, showSettings, action }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {showSettings && (
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

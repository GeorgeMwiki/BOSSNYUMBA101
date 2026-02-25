'use client';

import Link from 'next/link';

interface Story {
  id: string;
  name: string;
  avatar?: string;
  isOwn?: boolean;
  hasNew?: boolean;
}

const MOCK_STORIES: Story[] = [
  { id: '1', name: 'Your status', isOwn: true, hasNew: true },
  { id: '2', name: 'Sunrise Apartments', hasNew: true },
  { id: '3', name: 'Plumber Pro', hasNew: false },
  { id: '4', name: 'Electric Co', hasNew: false },
];

export function StoriesBar() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-4 pt-2 -mx-4">
      {MOCK_STORIES.map((s) => (
        <Link
          key={s.id}
          href={s.isOwn ? '/status/add' : `/status/${s.id}`}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
        >
          <div className={`relative ${s.hasNew ? 'story-ring' : ''}`}>
            <div
              className={`w-14 h-14 rounded-story overflow-hidden bg-surface-card border-2 flex items-center justify-center ${
                s.hasNew ? 'border-transparent' : 'border-white/20'
              }`}
            >
              {s.avatar ? (
                <img src={s.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-spotify-green">
                  {s.name.charAt(0)}
                </span>
              )}
            </div>
            {s.isOwn && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-spotify-green flex items-center justify-center text-black text-xs font-bold">
                +
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 max-w-[64px] truncate text-center">
            {s.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

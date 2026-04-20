'use client';

import { useTranslations } from 'next-intl';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';

interface FeedCardProps {
  id: string;
  author: { name: string; avatar?: string };
  content?: string;
  image?: string;
  likes?: number;
  comments?: number;
  timeAgo?: string;
}

export function FeedCard({
  author,
  content,
  image,
  likes = 0,
  comments = 0,
  timeAgo = '2h',
}: FeedCardProps) {
  const tA11y = useTranslations('a11y');
  return (
    <article className="card-feed mb-4">
      {/* Header - Instagram style */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-story overflow-hidden bg-surface-card flex items-center justify-center flex-shrink-0">
          {author.avatar ? (
            <img
              src={author.avatar}
              alt={tA11y('authorAvatar', { name: author.name })}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-spotify-green">
              {author.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{author.name}</p>
          <p className="text-xs text-gray-500">{timeAgo}</p>
        </div>
      </div>

      {/* Media / Content */}
      {image && (
        <div className="aspect-square w-full bg-surface-elevated">
          <img src={image} alt={tA11y('feedImage')} className="w-full h-full object-cover" />
        </div>
      )}
      {content && !image && (
        <p className="px-4 py-3 text-sm text-gray-300">{content}</p>
      )}

      {/* Actions - Instagram style */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={tA11y('like')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <Heart className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            <span className="text-sm">{likes || tA11y('like')}</span>
          </button>
          <button
            type="button"
            aria-label={tA11y('comment')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            <span className="text-sm">{comments || tA11y('comment')}</span>
          </button>
          <button
            type="button"
            aria-label={tA11y('share')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Share2 className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          aria-label={tA11y('bookmark')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <Bookmark className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

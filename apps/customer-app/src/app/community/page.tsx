'use client';

import Link from 'next/link';
import { Users, FileText, Calendar, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const communityPosts = [
  {
    id: '1',
    author: 'John K.',
    unit: 'A-204',
    content: 'Anyone know when the gym will reopen?',
    timestamp: '2024-02-12T14:30:00Z',
    replies: 3,
  },
  {
    id: '2',
    author: 'Mary W.',
    unit: 'B-105',
    content: 'Lost keys near the parking area. Found a set—please contact me if yours.',
    timestamp: '2024-02-11T09:15:00Z',
    replies: 1,
  },
  {
    id: '3',
    author: 'James M.',
    unit: 'A-301',
    content: 'Pool cleaning scheduled for tomorrow 9am. FYI.',
    timestamp: '2024-02-10T16:00:00Z',
    replies: 0,
  },
];

export default function CommunityPage() {
  return (
    <>
      <PageHeader title="Community" showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Quick Links */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/community/rules"
              className="card p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Property Rules</div>
                <div className="text-xs text-gray-500">Building guidelines</div>
              </div>
            </Link>
            <Link
              href="/announcements"
              className="card p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Announcements</div>
                <div className="text-xs text-gray-500">Property updates</div>
              </div>
            </Link>
          </div>
        </section>

        {/* Community Board */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Community Board
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Connect with neighbors—share updates, ask questions, or help out.
          </p>
          <div className="space-y-3">
            {communityPosts.map((post) => (
              <div key={post.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{post.author}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">Unit {post.unit}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{post.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>
                        {new Date(post.timestamp).toLocaleDateString()}
                      </span>
                      {post.replies > 0 && (
                        <span>{post.replies} replies</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {communityPosts.length === 0 && (
            <div className="card p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">No posts yet</p>
              <p className="text-sm text-gray-400">
                Be the first to share with the community
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

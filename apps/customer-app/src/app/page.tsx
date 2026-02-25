'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { StoriesBar } from '@/components/feed/StoriesBar';
import { FeedCard } from '@/components/feed/FeedCard';
import { VendorCard } from '@/components/marketplace/VendorCard';
import { CreditCard, Store, MessageCircle } from 'lucide-react';

const MOCK_FEED = [
  { id: '1', author: { name: 'Sunrise Apartments' }, content: 'Pool maintenance completed. Enjoy!', timeAgo: '2h', likes: 12, comments: 3 },
  { id: '2', author: { name: 'Estate Manager' }, content: 'New parking bays now available in Block B.', timeAgo: '5h', likes: 8, comments: 1 },
];

const MOCK_VENDORS = [
  { id: '1', name: 'Plumber Pro', category: 'Plumbing', rating: 4.8, price: 'From KES 2,000' },
  { id: '2', name: 'Electric Co', category: 'Electrical', rating: 4.9 },
  { id: '3', name: 'Cleaning Crew', category: 'Cleaning', rating: 4.7, price: 'KES 1,500/hr' },
  { id: '4', name: 'Locksmith Plus', category: 'Security', rating: 4.6 },
];

export default function CustomerAppHome() {
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/auth/login';
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-spotify-green border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  const greeting = user?.firstName ? `Welcome back, ${user.firstName}!` : 'Welcome back!';

  return (
    <main className="min-h-screen bg-[#121212]">
      <PageHeader title="BOSSNYUMBA" />

      <div className="px-4 py-4 pb-24 max-w-2xl mx-auto">
        {/* Greeting - Spotify style */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">{greeting}</h2>
          <p className="text-gray-400 mt-0.5">Your community feed</p>
        </div>

        {/* Stories - Instagram/TikTok/WhatsApp style */}
        <section className="mb-6">
          <StoriesBar />
        </section>

        {/* Quick action - Spotify-style card */}
        <Link
          href="/payments"
          className="card-spotify flex items-center gap-4 mb-6 group"
        >
          <div className="w-12 h-12 rounded-spotify bg-spotify-green flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">Pay rent</p>
            <p className="text-sm text-gray-400">KES 45,000 due</p>
          </div>
          <span className="text-spotify-green text-sm font-semibold group-hover:text-spotify-green-hover">Pay</span>
        </Link>

        {/* Feed - Instagram style */}
        <section className="mb-6">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            Feed
            <span className="text-xs font-normal text-gray-500">Community updates</span>
          </h3>
          {MOCK_FEED.map((post) => (
            <FeedCard key={post.id} {...post} />
          ))}
        </section>

        {/* Marketplace - TikTok Shop style */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-spotify-green" />
              Marketplace
            </h3>
            <Link href="/marketplace" className="text-spotify-green text-sm font-semibold hover:text-spotify-green-hover">
              See all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {MOCK_VENDORS.map((v) => (
              <VendorCard key={v.id} {...v} />
            ))}
          </div>
        </section>

        {/* Messages - WhatsApp style CTA */}
        <Link
          href="/messages"
          className="card-spotify flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-spotify bg-white/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-spotify-green" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">Messages</p>
            <p className="text-sm text-gray-400">Chat with estate manager & groups</p>
          </div>
          <span className="text-gray-400 group-hover:text-white">→</span>
        </Link>
      </div>
    </main>
  );
}

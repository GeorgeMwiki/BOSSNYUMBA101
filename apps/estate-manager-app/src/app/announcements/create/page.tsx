'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type Priority = 'normal' | 'important' | 'urgent';

export default function CreateAnnouncementPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal' as Priority,
    propertyId: '',
    publishNow: true,
    expiresAt: '',
    isPinned: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    // In real app: API call to create announcement
    router.push('/announcements');
  };

  return (
    <>
      <PageHeader title="Create Announcement" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              type="text"
              className="input"
              placeholder="Enter announcement title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Content *</label>
            <textarea
              className="input min-h-[120px]"
              placeholder="Write your announcement..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Priority</label>
            <select
              className="input"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="label">Property (optional)</label>
            <select
              className="input"
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            >
              <option value="">All Properties</option>
              <option value="1">Sunset Apartments</option>
              <option value="2">Riverside Towers</option>
            </select>
          </div>

          <div>
            <label className="label">Expiry Date (optional)</label>
            <input
              type="date"
              className="input"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={formData.isPinned}
              onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="isPinned" className="text-sm">Pin to top</label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={!formData.title || !formData.content}
          >
            <Megaphone className="w-4 h-4" />
            Publish Announcement
          </button>
        </div>
      </form>
    </>
  );
}

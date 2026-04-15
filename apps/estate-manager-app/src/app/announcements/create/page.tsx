'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Megaphone, Loader2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { announcementsApi } from '@/lib/api';
import { propertiesService } from '@bossnyumba/api-client';

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(5000),
  priority: z.enum(['normal', 'important', 'urgent']),
  propertyId: z.string().optional(),
  publishNow: z.boolean(),
  expiresAt: z.string().optional(),
  isPinned: z.boolean(),
});

type FormState = z.infer<typeof announcementSchema>;

export default function CreateAnnouncementPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormState>({
    title: '',
    content: '',
    priority: 'normal',
    propertyId: '',
    publishNow: true,
    expiresAt: '',
    isPinned: false,
  });

  const propertiesQuery = useQuery({
    queryKey: ['properties-options'],
    queryFn: () => propertiesService.list(),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      announcementsApi.create({
        title: data.title,
        content: data.content,
        priority: data.priority,
        propertyId: data.propertyId || undefined,
        publishNow: data.publishNow,
        expiresAt: data.expiresAt || undefined,
        isPinned: data.isPinned,
      }),
    onSuccess: (resp) => {
      if (resp.success) {
        router.push('/announcements');
      } else {
        setErrors({ form: resp.error?.message ?? 'Failed to create announcement' });
      }
    },
    onError: (err) => {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to create announcement' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = announcementSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    createMutation.mutate(parsed.data);
  };

  const properties = propertiesQuery.data?.data ?? [];

  return (
    <>
      <PageHeader title="Create Announcement" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {errors.form && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errors.form}</div>
          </div>
        )}

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
            {errors.title && <p className="text-xs text-danger-600 mt-1">{errors.title}</p>}
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
            {errors.content && <p className="text-xs text-danger-600 mt-1">{errors.content}</p>}
          </div>

          <div>
            <label className="label">Priority</label>
            <select
              className="input"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: e.target.value as FormState['priority'] })
              }
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
              disabled={propertiesQuery.isLoading}
            >
              <option value="">All Properties</option>
              {properties.map((property: any) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
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
            <label htmlFor="isPinned" className="text-sm">
              Pin to top
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="publishNow"
              checked={formData.publishNow}
              onChange={(e) => setFormData({ ...formData, publishNow: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="publishNow" className="text-sm">
              Publish immediately
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={createMutation.isPending || !formData.title || !formData.content}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Megaphone className="w-4 h-4" />
            )}
            Publish Announcement
          </button>
        </div>
      </form>
    </>
  );
}

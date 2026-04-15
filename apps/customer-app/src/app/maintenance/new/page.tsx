'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AlertCircle, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  CategorySelector,
  PrioritySelector,
  PhotoCapture,
  PRIORITIES,
  type PhotoPreview,
} from '@/components/requests';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const LOCATIONS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'storeroom', label: 'Storeroom' },
  { value: 'other', label: 'Other' },
];

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (9am - 12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm - 5pm)' },
  { value: 'evening', label: 'Evening (5pm - 8pm)' },
  { value: 'any', label: 'Any time' },
];

const schema = z.object({
  category: z.string().min(1, 'Category is required'),
  priority: z.string().min(1, 'Priority is required'),
  description: z.string().min(10, 'Please provide at least 10 characters'),
  location: z.string().optional(),
  permissionToEnter: z.boolean(),
  preferredSlot: z.string().optional(),
});

export default function NewMaintenancePage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    category: '',
    priority: 'normal',
    description: '',
    location: '',
    permissionToEnter: false,
    preferredSlot: '',
  });
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(formData);
      const attachments = photos.map((p, i) => ({
        type: 'image',
        url: p.url,
        filename: p.file?.name ?? `photo-${i + 1}.jpg`,
      }));
      return api.workOrders.create({
        title:
          parsed.description.length > 60
            ? `${parsed.description.slice(0, 57)}...`
            : parsed.description,
        description: parsed.description,
        category: parsed.category,
        priority: parsed.priority,
        location: parsed.location || undefined,
        preferredTimeSlot: parsed.preferredSlot || undefined,
        permissionToEnter: parsed.permissionToEnter,
        attachments: attachments.length ? attachments : undefined,
      });
    },
    onSuccess: (wo) => {
      toast.success('Maintenance request submitted');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      router.push(`/maintenance/${wo.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof z.ZodError) {
        setFieldError(err.issues[0]?.message ?? 'Please check your input');
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit request',
        'Submission failed'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    mutation.mutate();
  };

  const selectedPriority = PRIORITIES.find((p) => p.value === formData.priority);

  return (
    <>
      <PageHeader title="Report Issue" showBack />
      <form onSubmit={handleSubmit} className="space-y-6 px-4 py-4 pb-8">
        <section>
          <label className="label">What type of issue?</label>
          <CategorySelector
            value={formData.category}
            onChange={(value) => setFormData({ ...formData, category: value })}
          />
        </section>

        <section>
          <label className="label">How urgent is this?</label>
          <PrioritySelector
            value={formData.priority}
            onChange={(value) => setFormData({ ...formData, priority: value })}
          />
        </section>

        <section>
          <label className="label" htmlFor="description">
            Describe the problem
          </label>
          <textarea
            id="description"
            className="input min-h-[100px]"
            placeholder="e.g., Water is dripping from under the kitchen sink..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />
        </section>

        <section>
          <label className="label">Where in the unit?</label>
          <div className="grid grid-cols-2 gap-2">
            {LOCATIONS.map((loc) => {
              const isSelected = formData.location === loc.value;
              return (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, location: loc.value })
                  }
                  className={`card p-3 text-left transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">{loc.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <label className="label">Photos (optional but helpful)</label>
          <PhotoCapture photos={photos} onChange={setPhotos} maxPhotos={5} />
        </section>

        <section className="card p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="permission"
              className="mt-1 rounded border-gray-300"
              checked={formData.permissionToEnter}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  permissionToEnter: e.target.checked,
                })
              }
            />
            <div>
              <label
                htmlFor="permission"
                className="cursor-pointer text-sm font-medium"
              >
                Permission to enter if I&apos;m not home
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Allow maintenance staff to enter your unit to address this issue
              </p>
            </div>
          </div>
        </section>

        <section>
          <label className="label">Preferred time (optional)</label>
          <div className="space-y-2">
            {TIME_SLOTS.map((slot) => {
              const isSelected = formData.preferredSlot === slot.value;
              return (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, preferredSlot: slot.value })
                  }
                  className={`card w-full p-3 text-left transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">{slot.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {selectedPriority && (
          <div className="flex items-start gap-3 rounded-lg bg-primary-50 p-4 text-primary-900">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-primary-600" />
            <div className="text-sm">
              <p className="font-medium">Expected Response</p>
              <p className="text-primary-700">
                We aim to respond within <strong>{selectedPriority.sla}</strong>.
              </p>
            </div>
          </div>
        )}

        {fieldError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {fieldError}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary flex w-full items-center justify-center gap-2 py-3"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            'Submitting...'
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Request
            </>
          )}
        </button>
      </form>
    </>
  );
}

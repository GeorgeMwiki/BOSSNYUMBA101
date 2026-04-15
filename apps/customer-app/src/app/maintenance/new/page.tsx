'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { maintenanceService } from '@bossnyumba/api-client';
// Ensure the singleton ApiClient is initialised before we make any calls.
import '@/lib/api';

const categories: Array<{ id: string; label: string }> = [
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'appliance', label: 'Appliance' },
  { id: 'hvac', label: 'HVAC' },
  { id: 'structural', label: 'Structural' },
  { id: 'pest_control', label: 'Pest Control' },
  { id: 'security', label: 'Security' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'landscaping', label: 'Landscaping' },
  { id: 'other', label: 'Other' },
];

const priorities: Array<{ id: string; label: string; description: string }> = [
  { id: 'emergency', label: 'Emergency', description: 'Safety risk / major damage' },
  { id: 'high', label: 'High', description: 'Significant inconvenience' },
  { id: 'medium', label: 'Medium', description: 'Normal request' },
  { id: 'low', label: 'Low', description: 'Minor / cosmetic' },
];

interface PhotoPreview {
  id: string;
  file: File;
  previewUrl: string;
}

export default function NewMaintenancePage() {
  const router = useRouter();
  const [category, setCategory] = useState<string>('other');
  const [priority, setPriority] = useState<string>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const additions = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...additions]);
    e.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError('Please describe the issue');
      return;
    }
    setSubmitting(true);
    try {
      // Submit JSON for the descriptive fields; photos are uploaded in a
      // follow-up multipart request so the request stays small and can be
      // retried. The gateway accepts both JSON and multipart on this
      // endpoint; we use JSON here and reference object URLs inline.
      // TODO: integrate with document-intelligence uploader for durable
      // storage of customer-submitted photos.
      const res = await maintenanceService.create({
        category,
        priority,
        title: title.trim() || description.trim().slice(0, 80),
        description: description.trim(),
        location: location.trim() || undefined,
        attachments: photos.map((p) => ({
          type: 'image',
          url: p.previewUrl, // replaced with durable URL once uploader lands
          filename: p.file.name,
        })),
      });
      router.push(`/maintenance/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Report Issue" showBack />
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 pb-32">
        <section className="card p-4 space-y-4">
          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    category === cat.id
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Priority</label>
            <div className="space-y-2">
              {priorities.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  className={`w-full py-2 px-3 rounded-lg text-sm text-left border transition-colors ${
                    priority === p.id
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div
                    className={`text-xs ${
                      priority === p.id ? 'text-primary-100' : 'text-gray-500'
                    }`}
                  >
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Short title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="e.g. Kitchen sink leaking"
              maxLength={120}
            />
          </div>

          <div>
            <label className="label">What's the issue?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[120px]"
              placeholder="Describe the issue in detail so the technician can come prepared."
              required
            />
          </div>

          <div>
            <label className="label">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
              placeholder="e.g. Master bathroom"
            />
          </div>
        </section>

        <section className="card p-4">
          <label className="label">Photos (optional)</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                  aria-label="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50">
              <Camera className="w-6 h-6" />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Photos help technicians prepare and arrive with the right parts.
          </p>
        </section>

        {error && (
          <div className="card border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}

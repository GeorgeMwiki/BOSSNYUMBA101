'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { AttachmentUpload } from '@/components/maintenance';

const categories = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'appliance', label: 'Appliances' },
  { value: 'structural', label: 'Structural' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'security', label: 'Security' },
  { value: 'general', label: 'General' },
];

const priorities = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const mockProperties = [
  { id: '1', name: 'Sunset Apartments' },
  { id: '2', name: 'Riverside Estates' },
];

const mockUnits: Record<string, { id: string; name: string }[]> = {
  '1': [
    { id: 'u1', name: 'A-101' },
    { id: 'u2', name: 'A-101' },
    { id: 'u3', name: 'A-204' },
    { id: 'u4', name: 'B-102' },
    { id: 'u5', name: 'C-301' },
  ],
  '2': [
    { id: 'u6', name: 'Block 1' },
    { id: 'u7', name: 'Block 2' },
  ],
};

export default function WorkOrderForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    propertyId: '',
    unitId: '',
    category: '',
    priority: 'medium',
    title: '',
    description: '',
    location: '',
    permissionToEnter: false,
    entryInstructions: '',
  });
  const [attachments, setAttachments] = useState<
    { id: string; url: string; filename: string; type: 'image' | 'video' | 'document' }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const units = formData.propertyId ? mockUnits[formData.propertyId] || [] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    router.push('/work-orders');
  };

  return (
    <>
      <PageHeader title="Create Work Order" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        {/* Property & Unit */}
        <div className="space-y-3">
          <label className="label">Property</label>
          <select
            className="input"
            value={formData.propertyId}
            onChange={(e) =>
              setFormData({
                ...formData,
                propertyId: e.target.value,
                unitId: '',
              })
            }
            required
          >
            <option value="">Select property</option>
            {mockProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <label className="label">Unit</label>
          <select
            className="input"
            value={formData.unitId}
            onChange={(e) =>
              setFormData({ ...formData, unitId: e.target.value })
            }
          >
            <option value="">Select unit (optional)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="space-y-3">
          <label className="label">Category</label>
          <select
            className="input"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            required
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-3">
          <label className="label">Priority</label>
          <div className="flex gap-2 flex-wrap">
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  setFormData({ ...formData, priority: p.value })
                }
                className={`btn text-sm ${
                  formData.priority === p.value
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <label className="label">Title</label>
          <input
            type="text"
            className="input"
            placeholder="Brief description of the issue"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-3">
          <label className="label">Description</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Describe the issue in detail..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        {/* Location */}
        <div className="space-y-3">
          <label className="label">Specific Location</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Kitchen, under sink"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
          />
        </div>

        {/* Photos */}
        <div className="space-y-3">
          <label className="label">Photos</label>
          <AttachmentUpload
            value={attachments}
            onChange={setAttachments}
            maxFiles={5}
          />
        </div>

        {/* Entry Permission */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.permissionToEnter}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  permissionToEnter: e.target.checked,
                })
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm">Permission to enter when absent</span>
          </label>
          {formData.permissionToEnter && (
            <input
              type="text"
              className="input"
              placeholder="Entry instructions (e.g. key location)"
              value={formData.entryInstructions}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  entryInstructions: e.target.value,
                })
              }
            />
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex-1"
          >
            {isSubmitting ? 'Creating...' : 'Create Work Order'}
          </button>
        </div>
      </form>
    </>
  );
}

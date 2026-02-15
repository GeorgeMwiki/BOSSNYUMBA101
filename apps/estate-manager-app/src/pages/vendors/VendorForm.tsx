'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const categories = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'pest_control',
  'security',
  'general',
];

export default function VendorForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    type: 'company' as 'company' | 'individual',
    phone: '',
    email: '',
    address: '',
    selectedCategories: [] as string[],
    hourlyRate: '',
    callOutFee: '',
    paymentTerms: 'Net 30',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(cat)
        ? prev.selectedCategories.filter((c) => c !== cat)
        : [...prev.selectedCategories, cat],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    router.push('/vendors');
  };

  return (
    <>
      <PageHeader title="Add Vendor" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <label className="label">Vendor Name</label>
          <input
            type="text"
            className="input"
            placeholder="Company or individual name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />
        </div>

        <div className="space-y-3">
          <label className="label">Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'company' })}
              className={`btn flex-1 ${
                formData.type === 'company' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              Company
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'individual' })}
              className={`btn flex-1 ${
                formData.type === 'individual' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              Individual
            </button>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <label className="label">Phone</label>
          <input
            type="tel"
            className="input"
            placeholder="+254 7XX XXX XXX"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            required
          />
        </div>

        <div className="space-y-3">
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="vendor@example.com"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>

        <div className="space-y-3">
          <label className="label">Address</label>
          <input
            type="text"
            className="input"
            placeholder="Physical address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        {/* Specializations */}
        <div className="space-y-3">
          <label className="label">Service Categories</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`btn text-sm ${
                  formData.selectedCategories.includes(cat)
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {cat.replace('_', ' ')}
                {formData.selectedCategories.includes(cat) && (
                  <X className="w-3 h-3 ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Rate Card */}
        <div className="card p-4 space-y-3">
          <h3 className="font-medium">Rate Card</h3>
          <div>
            <label className="label">Hourly Rate (KES)</label>
            <input
              type="text"
              className="input"
              placeholder="2500"
              value={formData.hourlyRate}
              onChange={(e) =>
                setFormData({ ...formData, hourlyRate: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Call-out Fee (KES)</label>
            <input
              type="text"
              className="input"
              placeholder="1500"
              value={formData.callOutFee}
              onChange={(e) =>
                setFormData({ ...formData, callOutFee: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Payment Terms</label>
            <select
              className="input"
              value={formData.paymentTerms}
              onChange={(e) =>
                setFormData({ ...formData, paymentTerms: e.target.value })
              }
            >
              <option value="Net 7">Net 7</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
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
            {isSubmitting ? 'Saving...' : 'Add Vendor'}
          </button>
        </div>
      </form>
    </>
  );
}

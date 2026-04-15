'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { vendorsApi } from '@/lib/api';

const categories = [
  'PLUMBING',
  'ELECTRICAL',
  'HVAC',
  'APPLIANCE',
  'STRUCTURAL',
  'GENERAL',
];

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['company', 'individual']),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().optional(),
  selectedCategories: z
    .array(z.string())
    .min(1, 'Pick at least one service category'),
  hourlyRate: z.string().optional(),
  callOutFee: z.string().optional(),
  paymentTerms: z.string(),
});

type VendorFormState = z.infer<typeof vendorSchema>;

const emptyForm: VendorFormState = {
  name: '',
  type: 'company',
  phone: '',
  email: '',
  address: '',
  selectedCategories: [],
  hourlyRate: '',
  callOutFee: '',
  paymentTerms: 'Net 30',
};

export default function VendorForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<VendorFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (values: VendorFormState) =>
      vendorsApi.create({
        name: values.name,
        companyName: values.type === 'company' ? values.name : undefined,
        email: values.email || '',
        phone: values.phone,
        categories: values.selectedCategories,
        hourlyRate: values.hourlyRate ? Number(values.hourlyRate) : undefined,
        callOutFee: values.callOutFee ? Number(values.callOutFee) : undefined,
        paymentTerms: values.paymentTerms,
        address: values.address || undefined,
        isAvailable: true,
      }),
    onSuccess: (resp: { success?: boolean; error?: { message?: string } }) => {
      if (resp?.success === false) {
        setErrors({ form: resp.error?.message ?? 'Failed to create vendor' });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      router.push('/vendors');
    },
    onError: (err) => {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to create vendor',
      });
    },
  });

  const toggleCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(cat)
        ? prev.selectedCategories.filter((c) => c !== cat)
        : [...prev.selectedCategories, cat],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = vendorSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <>
      <PageHeader title="Add Vendor" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {errors.form && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errors.form}</div>
          </div>
        )}

        <div className="space-y-3">
          <label className="label">Vendor Name</label>
          <input
            type="text"
            className="input"
            placeholder="Company or individual name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          {errors.name && <p className="text-xs text-danger-600 mt-1">{errors.name}</p>}
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

        <div className="space-y-3">
          <label className="label">Phone</label>
          <input
            type="tel"
            className="input"
            placeholder="+254 7XX XXX XXX"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
          {errors.phone && <p className="text-xs text-danger-600 mt-1">{errors.phone}</p>}
        </div>

        <div className="space-y-3">
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="vendor@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          {errors.email && <p className="text-xs text-danger-600 mt-1">{errors.email}</p>}
        </div>

        <div className="space-y-3">
          <label className="label">Address</label>
          <input
            type="text"
            className="input"
            placeholder="Physical address"
            value={formData.address ?? ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          <label className="label">Service Categories</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`btn text-sm ${
                  formData.selectedCategories.includes(cat) ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {cat.replace('_', ' ')}
                {formData.selectedCategories.includes(cat) && <X className="w-3 h-3 ml-1" />}
              </button>
            ))}
          </div>
          {errors.selectedCategories && (
            <p className="text-xs text-danger-600 mt-1">{errors.selectedCategories}</p>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="font-medium">Rate Card</h3>
          <div>
            <label className="label">Hourly Rate (KES)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              placeholder="2500"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Call-out Fee (KES)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              placeholder="1500"
              value={formData.callOutFee}
              onChange={(e) => setFormData({ ...formData, callOutFee: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Payment Terms</label>
            <select
              className="input"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
            >
              <option value="Net 7">Net 7</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Vendor
          </button>
        </div>
      </form>
    </>
  );
}

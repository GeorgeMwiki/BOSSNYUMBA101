'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Send, User, Building2, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { messagingApi } from '@/lib/api';
import { customersService } from '@bossnyumba/api-client';

const formSchema = z.object({
  recipientType: z.enum(['tenant', 'staff']),
  recipientId: z.string().min(1, 'Select a recipient'),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
});

type FormState = z.infer<typeof formSchema>;

export default function NewConversationPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormState>({
    recipientType: 'tenant',
    recipientId: '',
    subject: '',
    message: '',
  });
  const [search, setSearch] = useState('');

  const tenantsQuery = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersService.list({ pageSize: 100 }),
    retry: false,
    enabled: formData.recipientType === 'tenant',
  });

  const tenants = tenantsQuery.data?.data ?? [];

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t: any) => {
      const name = [t.firstName, t.lastName].filter(Boolean).join(' ');
      return name.toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q);
    });
  }, [tenants, search]);

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      messagingApi.createConversation(data.recipientId, data.subject, data.message),
    onSuccess: (resp) => {
      if (resp.success && resp.data?.id) {
        router.push(`/messaging/${resp.data.id}`);
      } else {
        setErrors({ form: resp.error?.message ?? 'Failed to start conversation' });
      }
    },
    onError: (err) => {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to start conversation' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = formSchema.safeParse(formData);
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

  return (
    <>
      <PageHeader title="New Message" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {errors.form && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errors.form}</div>
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Recipient Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, recipientType: 'tenant', recipientId: '' })
                }
                className={`btn flex-1 ${
                  formData.recipientType === 'tenant' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <User className="w-4 h-4" />
                Tenant
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, recipientType: 'staff', recipientId: '' })
                }
                className={`btn flex-1 ${
                  formData.recipientType === 'staff' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Staff
              </button>
            </div>
          </div>

          <div>
            <label className="label">Select Recipient</label>
            <input
              type="text"
              placeholder="Search..."
              className="input mb-3"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {formData.recipientType === 'tenant' && tenantsQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading tenants...
              </div>
            )}
            {formData.recipientType === 'staff' && (
              <div className="p-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
                Direct-to-staff messaging is routed through the admin directory. Contact your
                administrator to enable internal routing for this inbox.
              </div>
            )}
            {formData.recipientType === 'tenant' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredTenants.map((r: any) => {
                  const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, recipientId: r.id })}
                      className={`w-full p-3 rounded-lg text-left border transition-colors ${
                        formData.recipientId === r.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{name}</div>
                      {r.email && <div className="text-sm text-gray-500">{r.email}</div>}
                    </button>
                  );
                })}
              </div>
            )}
            {errors.recipientId && (
              <p className="text-xs text-danger-600 mt-1">{errors.recipientId}</p>
            )}
          </div>

          <div>
            <label className="label">Subject</label>
            <input
              type="text"
              className="input"
              placeholder="Enter subject..."
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
            {errors.subject && <p className="text-xs text-danger-600 mt-1">{errors.subject}</p>}
          </div>

          <div>
            <label className="label">Message</label>
            <textarea
              className="input min-h-[120px]"
              placeholder="Type your message..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
            {errors.message && <p className="text-xs text-danger-600 mt-1">{errors.message}</p>}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Message
          </button>
        </div>
      </form>
    </>
  );
}

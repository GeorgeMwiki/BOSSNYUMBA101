'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, User, Building2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { customersService } from '@bossnyumba/api-client';

export default function NewConversationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    recipientType: 'tenant' as 'tenant' | 'staff',
    recipientId: '',
    subject: '',
    message: '',
  });
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersService.list();
      return response.data;
    },
  });

  const tenants = (customersData ?? []).map((c: any) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    unit: c.currentUnit?.unitNumber ?? c.currentLease?.unitNumber ?? '',
    property: c.propertyName ?? '',
  }));

  const staff = [
    { id: 'maintenance-team', name: 'Maintenance Team', role: 'Maintenance' },
    { id: 'property-manager', name: 'Property Manager', role: 'Management' },
  ];

  const recipients = formData.recipientType === 'tenant' ? tenants : staff;
  const filteredRecipients = recipients.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipientId || !formData.subject || !formData.message) return;
    setIsSending(true);
    try {
      // API call to create conversation would go here
      router.push('/messaging');
    } catch {
      setIsSending(false);
    }
  };

  return (
    <>
      <PageHeader title="New Message" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Recipient Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recipientType: 'tenant', recipientId: '' })}
                className={`btn flex-1 ${formData.recipientType === 'tenant' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <User className="w-4 h-4" />
                Tenant
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recipientType: 'staff', recipientId: '' })}
                className={`btn flex-1 ${formData.recipientType === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
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
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredRecipients.map((r) => (
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
                  <div className="font-medium">{r.name}</div>
                  {formData.recipientType === 'tenant' && 'unit' in r && (
                    <div className="text-sm text-gray-500">Unit {(r as { unit: string }).unit}</div>
                  )}
                  {formData.recipientType === 'staff' && 'role' in r && (
                    <div className="text-sm text-gray-500">{(r as { role: string }).role}</div>
                  )}
                </button>
              ))}
            </div>
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
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={!formData.recipientId || !formData.subject || !formData.message || isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Message
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}

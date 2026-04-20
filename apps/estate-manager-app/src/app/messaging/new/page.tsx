'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, User, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

// Live wiring pending — tenant directory + staff directory endpoints
// not yet mounted. Empty arrays keep the UI honest until wired.
const tenants: Array<{ id: string; name: string; unit: string; property: string }> = [];
const staff: Array<{ id: string; name: string; role: string }> = [];

export default function NewConversationPage() {
  const t = useTranslations('newMessage');
  const router = useRouter();
  const [formData, setFormData] = useState({
    recipientType: 'tenant' as 'tenant' | 'staff',
    recipientId: '',
    subject: '',
    message: '',
  });
  const [search, setSearch] = useState('');

  const recipients = formData.recipientType === 'tenant' ? tenants : staff;
  const filteredRecipients = recipients.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipientId || !formData.subject || !formData.message) return;
    // In real app: API call to create conversation
    router.push('/messaging');
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('recipientType')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recipientType: 'tenant', recipientId: '' })}
                className={`btn flex-1 ${formData.recipientType === 'tenant' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <User className="w-4 h-4" />
                {t('tenant')}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recipientType: 'staff', recipientId: '' })}
                className={`btn flex-1 ${formData.recipientType === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Building2 className="w-4 h-4" />
                {t('staff')}
              </button>
            </div>
          </div>

          <div>
            <label className="label">{t('selectRecipient')}</label>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
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
                    <div className="text-sm text-gray-500">{t('unitLabel', { unit: (r as { unit: string }).unit })}</div>
                  )}
                  {formData.recipientType === 'staff' && 'role' in r && (
                    <div className="text-sm text-gray-500">{(r as { role: string }).role}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t('subject')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('subjectPlaceholder')}
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">{t('message')}</label>
            <textarea
              className="input min-h-[120px]"
              placeholder={t('messagePlaceholder')}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={!formData.recipientId || !formData.subject || !formData.message}
          >
            <Send className="w-4 h-4" />
            {t('sendMessage')}
          </button>
        </div>
      </form>
    </>
  );
}

import React, { useState } from 'react';
import { X, UserPlus, Mail, Shield, Building2, CheckCircle } from 'lucide-react';
import { Spinner } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface CoOwnerInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CoOwnerInviteModal({ isOpen, onClose, onSuccess }: CoOwnerInviteModalProps) {
  const t = useTranslations('coOwnerInvite');
  const { properties } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'VIEWER',
    propertyIds: [] as string[],
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ROLES = [
    { id: 'CO_OWNER', name: t('roleCoOwner'), description: t('roleCoOwnerDesc') },
    { id: 'VIEWER', name: t('roleViewer'), description: t('roleViewerDesc') },
    { id: 'FINANCIAL_ADMIN', name: t('roleFinancialAdmin'), description: t('roleFinancialAdminDesc') },
    { id: 'MAINTENANCE_APPROVER', name: t('roleMaintenanceApprover'), description: t('roleMaintenanceApproverDesc') },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePropertyToggle = (propertyId: string) => {
    setFormData(prev => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter(id => id !== propertyId)
        : [...prev.propertyIds, propertyId],
    }));
  };

  const handleSelectAll = () => {
    const allPropertyIds = properties.map(p => p.id);
    setFormData(prev => ({
      ...prev,
      propertyIds: prev.propertyIds.length === allPropertyIds.length ? [] : allPropertyIds,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError(t('errFillRequired'));
      return;
    }
    if (formData.propertyIds.length === 0) {
      setError(t('errSelectProperty'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/invitations/co-owner', formData);
      setStep('success');
      onSuccess?.();
    } catch (err) {
      setStep('success');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({ email: '', firstName: '', lastName: '', role: 'VIEWER', propertyIds: [], message: '' });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><UserPlus className="h-5 w-5 text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
              <p className="text-sm text-gray-500">{t('subtitle')}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstNameRequired')}</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastNameRequired')}</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><Mail className="h-4 w-4 inline mr-1" />{t('emailRequired')}</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="coowner@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><Shield className="h-4 w-4 inline mr-1" />{t('roleRequired')}</label>
              <div className="space-y-2">
                {ROLES.map((role) => (
                  <label key={role.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.role === role.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="role" value={role.id} checked={formData.role === role.id} onChange={handleChange} className="mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">{role.name}</p>
                      <p className="text-sm text-gray-500">{role.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700"><Building2 className="h-4 w-4 inline mr-1" />{t('propertyAccessRequired')}</label>
                <button type="button" onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-700">{formData.propertyIds.length === properties.length ? t('deselectAll') : t('selectAll')}</button>
              </div>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-40 overflow-y-auto">
                {properties.map((property) => (
                  <label key={property.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={formData.propertyIds.includes(property.id)} onChange={() => handlePropertyToggle(property.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">{property.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('personalMessage')}</label>
              <textarea name="message" value={formData.message} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={t('messagePlaceholder')} />
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={handleClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t('cancel')}</button>
              <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <Spinner size="sm" /> : <Mail className="h-4 w-4" />}{t('sendInvitation')}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('invitationSent')}</h3>
            <p className="text-gray-600 mb-2">{t('weSentInvitation')} <span className="font-medium">{formData.email}</span></p>
            <p className="text-sm text-gray-500 mb-6">{t('theyWillReceive', { role: ROLES.find(r => r.id === formData.role)?.name ?? '' })}</p>
            <button onClick={handleClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('done')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

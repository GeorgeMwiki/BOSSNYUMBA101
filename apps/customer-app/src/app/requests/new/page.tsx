'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  CategorySelector,
  PrioritySelector,
  PhotoCapture,
  PRIORITIES,
  type PhotoPreview,
} from '@/components/requests';

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

const QUICK_DESCRIPTIONS: Record<string, string[]> = {
  plumbing: ['Leaking faucet', 'Clogged drain', 'No hot water', 'Pipe burst', 'Water pressure low'],
  electrical: ['Outlet not working', 'Light switch broken', 'Flickering lights', 'Power outage', 'Circuit tripped'],
  hvac: ['AC not cooling', 'Heater not working', 'Strange noise', 'No air flow'],
  appliances: ['Fridge not cooling', 'Stove not heating', 'Washer leaking', 'Dishwasher broken'],
  structural: ['Door won\'t close', 'Window stuck', 'Crack in wall', 'Floor damage'],
  pest_control: ['Ants', 'Cockroaches', 'Rodents', 'Mosquitoes'],
  security: ['Lock broken', 'Key stuck', 'Intercom not working'],
  general: ['Other issue'],
};

export default function NewRequestPage() {
  const t = useTranslations('newRequestPage');
  const router = useRouter();
  const [formData, setFormData] = useState({
    category: '',
    priority: 'normal',
    description: '',
    location: '',
    permissionToEnter: false,
    preferredSlot: '',
  });
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    router.push('/requests?submitted=true');
  };

  const selectedPriority = PRIORITIES.find((p) => p.value === formData.priority);

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 pb-8">
        {/* Category */}
        <section>
          <label className="label">{t('whatType')}</label>
          <CategorySelector
            value={formData.category}
            onChange={(value) => setFormData({ ...formData, category: value })}
          />
        </section>

        {/* Priority */}
        <section>
          <label className="label">{t('howUrgent')}</label>
          <PrioritySelector
            value={formData.priority}
            onChange={(value) => setFormData({ ...formData, priority: value })}
          />
        </section>

        {/* Problem Description */}
        <section>
          <label className="label" htmlFor="description">
            {t('describeProblem')}
          </label>
          {formData.category && QUICK_DESCRIPTIONS[formData.category] && (
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_DESCRIPTIONS[formData.category].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFormData({ ...formData, description: preset })}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    formData.description === preset
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          )}
          <textarea
            id="description"
            className="input min-h-[100px]"
            placeholder={t('descriptionPlaceholder')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </section>

        {/* Location in Unit */}
        <section>
          <label className="label">{t('whereInUnit')}</label>
          <div className="grid grid-cols-2 gap-2">
            {LOCATIONS.map((loc) => {
              const isSelected = formData.location === loc.value;
              return (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, location: loc.value })}
                  className={`card p-3 text-left transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium text-sm">{loc.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Photo Upload */}
        <section>
          <label className="label">{t('photosLabel')}</label>
          <PhotoCapture
            photos={photos}
            onChange={setPhotos}
            maxPhotos={5}
          />
        </section>

        {/* Permission to Enter */}
        <section className="card p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="permission"
              className="mt-1 rounded border-gray-300"
              checked={formData.permissionToEnter}
              onChange={(e) =>
                setFormData({ ...formData, permissionToEnter: e.target.checked })
              }
            />
            <div>
              <label htmlFor="permission" className="font-medium text-sm cursor-pointer">
                {t('permissionLabel')}
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {t('permissionDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* Preferred Time Slots */}
        <section>
          <label className="label">{t('preferredTime')}</label>
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
                  className={`card p-3 w-full text-left transition-all ${
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

        {/* SLA Info */}
        {selectedPriority && (
          <div className="bg-primary-50 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary-900">{t('expectedResponse')}</p>
              <p className="text-primary-700">
                {t('aimRespond', { sla: selectedPriority.sla })}
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={!formData.category || !formData.description || isSubmitting}
        >
          {isSubmitting ? t('submitting') : t('submitRequest')}
        </button>
      </form>
    </>
  );
}

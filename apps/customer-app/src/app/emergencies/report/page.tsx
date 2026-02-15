'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone,
  AlertTriangle,
  Droplets,
  Zap,
  Shield,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const emergencyTypes = [
  {
    value: 'water',
    label: 'Water Leak / Flooding',
    icon: Droplets,
    description: 'Burst pipe, major leak, flooding',
  },
  {
    value: 'power',
    label: 'Power Outage',
    icon: Zap,
    description: 'No electricity, electrical hazard',
  },
  {
    value: 'security',
    label: 'Security Issue',
    icon: Shield,
    description: 'Break-in, suspicious activity, lock issue',
  },
  {
    value: 'other',
    label: 'Other Emergency',
    icon: AlertTriangle,
    description: 'Gas leak, structural damage, etc.',
  },
];

export default function ReportEmergencyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    canBeReached: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.push('/emergencies?reported=true');
  };

  return (
    <>
      <PageHeader title="Report Emergency" showBack />

      <div className="px-4 py-4 space-y-6">
        <div className="card p-4 bg-danger-50 border-danger-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-danger-900">
                For life-threatening emergencies
              </h3>
              <p className="text-sm text-danger-700 mt-1">
                Call <strong>999</strong> immediately. Do not use this form.
              </p>
              <a
                href="tel:999"
                className="inline-flex items-center gap-2 mt-2 text-danger-700 font-medium"
              >
                <Phone className="w-4 h-4" />
                Call 999 now
              </a>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <label className="label">What type of emergency?</label>
            <div className="space-y-2">
              {emergencyTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: type.value })
                    }
                    className={`card p-4 w-full text-left flex items-start gap-3 transition-all ${
                      formData.type === type.value
                        ? 'ring-2 ring-primary-500 bg-primary-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {type.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label className="label" htmlFor="description">
              Brief description
            </label>
            <textarea
              id="description"
              className="input min-h-[80px]"
              placeholder="Describe what is happening..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </section>

          <section>
            <label className="label" htmlFor="location">
              Location
            </label>
            <input
              type="text"
              id="location"
              className="input"
              placeholder="e.g., Unit A-204, main bathroom"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
          </section>

          <section className="card p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="reachable"
                className="mt-1"
                checked={formData.canBeReached}
                onChange={(e) =>
                  setFormData({ ...formData, canBeReached: e.target.checked })
                }
              />
              <label htmlFor="reachable" className="text-sm cursor-pointer">
                I can be reached at my registered phone number
              </label>
            </div>
          </section>

          <div className="bg-primary-50 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div className="text-sm text-primary-800">
              <p className="font-medium">What happens next</p>
              <p className="mt-1">
                We will contact you immediately. For urgent issues, please also
                call the emergency numbers.
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={!formData.type || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Report Emergency'}
          </button>
        </form>
      </div>
    </>
  );
}

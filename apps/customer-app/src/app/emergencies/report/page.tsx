'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone,
  AlertTriangle,
  Droplets,
  Zap,
  Shield,
  Info,
  Camera,
  MapPin,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

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

interface Photo {
  id: string;
  url: string;
  dataUrl: string;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ReportEmergencyPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    canBeReached: true,
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotos((prev) => [
        ...prev,
        {
          id: `photo_${Date.now()}`,
          url: URL.createObjectURL(file),
          dataUrl,
        },
      ]);
    } catch {
      toast.error('Failed to read photo');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const detectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported on this device');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          location: `${prev.location ? prev.location + ' — ' : ''}GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        }));
        setDetectingLocation(false);
        toast.success('Location attached');
      },
      () => {
        setDetectingLocation(false);
        toast.error('Could not get your location');
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;
    setError('');
    setSubmitting(true);

    try {
      await api.emergencies.report({
        type: formData.type,
        description: formData.description.trim(),
        location: formData.location.trim(),
        canBeReached: formData.canBeReached,
        photos: photos.map((p) => p.dataUrl),
      });
      toast.success('Emergency reported. We are contacting you.');
      router.push('/emergencies?reported=true');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to report emergency';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Report Emergency" showBack />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoAdd}
      />

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
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0" htmlFor="location">
                Location
              </label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={detectingLocation}
                className="text-xs text-primary-600 font-medium flex items-center gap-1 disabled:text-gray-400"
              >
                <MapPin className="w-3 h-3" />
                {detectingLocation ? 'Detecting...' : 'Use my location'}
              </button>
            </div>
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

          <section>
            <label className="label">Photos (optional)</label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  <img
                    src={p.url}
                    alt="Emergency"
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full text-white flex items-center justify-center"
                    aria-label="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs mt-1">Add</span>
                </button>
              )}
            </div>
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

          {error && (
            <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">
              {error}
            </div>
          )}

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
            disabled={!formData.type || submitting}
          >
            {submitting ? 'Submitting...' : 'Report Emergency'}
          </button>
        </form>
      </div>
    </>
  );
}

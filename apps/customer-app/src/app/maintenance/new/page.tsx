'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, AlertTriangle, Info, Mic, X, Play, Pause, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { VoiceRecorder } from '@/components/maintenance/VoiceRecorder';

const categories = [
  { value: 'plumbing', label: 'Plumbing', description: 'Leaks, clogs, water issues' },
  { value: 'electrical', label: 'Electrical', description: 'Lights, outlets, wiring' },
  { value: 'hvac', label: 'HVAC', description: 'Heating, cooling, ventilation' },
  { value: 'appliance', label: 'Appliances', description: 'Fridge, stove, washer' },
  { value: 'structural', label: 'Structural', description: 'Walls, floors, doors, windows' },
  { value: 'pest_control', label: 'Pest Control', description: 'Insects, rodents' },
  { value: 'security', label: 'Security', description: 'Locks, alarms, access' },
  { value: 'general', label: 'General', description: 'Other maintenance issues' },
];

const priorities = [
  { 
    value: 'emergency', 
    label: 'Emergency', 
    description: 'Safety hazard, no water/power, flooding',
    sla: '4 hour response'
  },
  { 
    value: 'high', 
    label: 'High', 
    description: 'Major inconvenience, limited functionality',
    sla: '24 hour response'
  },
  { 
    value: 'medium', 
    label: 'Medium', 
    description: 'Needs attention but not urgent',
    sla: '72 hour response'
  },
  { 
    value: 'low', 
    label: 'Low', 
    description: 'Minor issue, cosmetic',
    sla: '7 day response'
  },
];

export default function NewMaintenancePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    category: '',
    priority: 'medium',
    title: '',
    description: '',
    location: '',
    permissionToEnter: false,
    entryInstructions: '',
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceNote, setVoiceNote] = useState<{ blob: Blob; duration: number } | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Navigate to confirmation
    router.push('/maintenance?submitted=true');
  };

  const handlePhotoUpload = () => {
    // Simulate photo upload
    setPhotos([...photos, `/placeholder-${photos.length + 1}.jpg`]);
  };

  const selectedPriority = priorities.find((p) => p.value === formData.priority);

  return (
    <>
      <PageHeader title="Report Issue" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        {/* Category Selection */}
        <section>
          <label className="label">What type of issue?</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat.value })}
                className={`card p-3 text-left transition-all ${
                  formData.category === cat.value
                    ? 'ring-2 ring-primary-500 bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{cat.label}</div>
                <div className="text-xs text-gray-500">{cat.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Priority Selection */}
        <section>
          <label className="label">How urgent is this?</label>
          <div className="space-y-2">
            {priorities.map((priority) => (
              <button
                key={priority.value}
                type="button"
                onClick={() => setFormData({ ...formData, priority: priority.value })}
                className={`card p-3 w-full text-left transition-all ${
                  formData.priority === priority.value
                    ? 'ring-2 ring-primary-500 bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {priority.value === 'emergency' && (
                        <AlertTriangle className="w-4 h-4 text-danger-500" />
                      )}
                      {priority.label}
                    </div>
                    <div className="text-xs text-gray-500">{priority.description}</div>
                  </div>
                  <div className="text-xs text-primary-600 font-medium">{priority.sla}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Input Mode Toggle */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <label className="label mb-0">Describe your issue</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  inputMode === 'text'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500'
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setInputMode('voice')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                  inputMode === 'voice'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500'
                }`}
              >
                <Mic className="w-3 h-3" />
                Voice
              </button>
            </div>
          </div>

          {inputMode === 'text' ? (
            <>
              {/* Issue Details - Text Mode */}
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="title">
                    Brief description
                  </label>
                  <input
                    type="text"
                    id="title"
                    className="input"
                    placeholder="e.g., Kitchen sink is leaking"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required={inputMode === 'text'}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="description">
                    More details
                  </label>
                  <textarea
                    id="description"
                    className="input min-h-[100px]"
                    placeholder="Please describe the issue in detail..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required={inputMode === 'text'}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Voice Note Mode */
            <div className="space-y-4">
              <VoiceRecorder
                onRecordingComplete={(blob, duration) => {
                  setVoiceNote({ blob, duration });
                  // Auto-fill title if empty
                  if (!formData.title) {
                    setFormData((prev) => ({
                      ...prev,
                      title: `Voice request - ${formData.category || 'Maintenance'}`,
                    }));
                  }
                }}
                maxDuration={120}
              />

              {voiceNote && (
                <div className="p-3 bg-success-50 rounded-lg flex items-center gap-2 text-success-700">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">Voice note recorded ({Math.round(voiceNote.duration)}s)</span>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Record a voice message describing your issue in Swahili or English. We&apos;ll transcribe it automatically.
              </p>
            </div>
          )}
        </section>

        <section>
          <label className="label" htmlFor="location">
            Location in unit
          </label>
          <input
            type="text"
            id="location"
            className="input"
            placeholder="e.g., Master bathroom, under sink"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
          />
        </section>

        {/* Photo Upload */}
        <section>
          <label className="label">Photos (optional but helpful)</label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo, index) => (
              <div
                key={index}
                className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"
              />
            ))}
            <button
              type="button"
              onClick={handlePhotoUpload}
              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 flex-shrink-0"
            >
              <Camera className="w-6 h-6" />
              <span className="text-xs mt-1">Add</span>
            </button>
          </div>
        </section>

        {/* Entry Permission */}
        <section className="card p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="permission"
              className="mt-1"
              checked={formData.permissionToEnter}
              onChange={(e) =>
                setFormData({ ...formData, permissionToEnter: e.target.checked })
              }
            />
            <div>
              <label htmlFor="permission" className="font-medium text-sm cursor-pointer">
                Permission to enter if I&apos;m not home
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Allow maintenance staff to enter your unit to address this issue
              </p>
            </div>
          </div>

          {formData.permissionToEnter && (
            <div className="mt-3">
              <label className="label" htmlFor="entryInstructions">
                Entry instructions (optional)
              </label>
              <textarea
                id="entryInstructions"
                className="input"
                placeholder="e.g., Key is with security, pet in bedroom..."
                value={formData.entryInstructions}
                onChange={(e) =>
                  setFormData({ ...formData, entryInstructions: e.target.value })
                }
              />
            </div>
          )}
        </section>

        {/* SLA Info */}
        {selectedPriority && (
          <div className="bg-primary-50 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary-900">Expected Response Time</p>
              <p className="text-primary-700">
                Based on the priority you selected, we aim to respond within{' '}
                <strong>{selectedPriority.sla.replace(' response', '')}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={!formData.category || !formData.title || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </>
  );
}

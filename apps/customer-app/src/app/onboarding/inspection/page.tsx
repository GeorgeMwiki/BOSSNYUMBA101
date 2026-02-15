'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Info,
  Gauge,
  Droplets,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ESignature } from '@/components/ESignature';
import { api } from '@/lib/api';

interface InspectionRoom {
  id: string;
  name: string;
  description: string;
  checkpoints: InspectionCheckpoint[];
}

interface InspectionCheckpoint {
  id: string;
  name: string;
  description: string;
  photos: InspectionPhoto[];
  notes: string;
  condition: 'good' | 'fair' | 'poor' | 'not_inspected';
}

interface InspectionPhoto {
  id: string;
  url: string;
  caption: string;
}

interface MeterReading {
  id: string;
  name: string;
  icon: React.ElementType;
  unit: string;
  value: string;
  meterNumber: string;
  placeholder: string;
  required: boolean;
}

const INSPECTION_ROOMS: Omit<InspectionRoom, 'checkpoints'>[] = [
  { id: 'living', name: 'Living Room', description: 'Main living area' },
  { id: 'kitchen', name: 'Kitchen', description: 'Kitchen and dining area' },
  { id: 'bedroom_1', name: 'Master Bedroom', description: 'Primary bedroom' },
  { id: 'bedroom_2', name: 'Second Bedroom', description: 'Guest/second bedroom' },
  { id: 'bathroom_1', name: 'Main Bathroom', description: 'Primary bathroom' },
  { id: 'bathroom_2', name: 'Second Bathroom', description: 'Guest bathroom/en-suite' },
  { id: 'balcony', name: 'Balcony/Outdoor', description: 'Outdoor areas' },
];

const CHECKPOINT_ITEMS = [
  'Walls & Paint',
  'Flooring',
  'Ceiling',
  'Doors & Locks',
  'Windows',
  'Light Fixtures',
  'Electrical Outlets',
  'Plumbing/Faucets',
];

const conditionColors = {
  good: 'bg-success-50 text-success-600 border-success-200',
  fair: 'bg-warning-50 text-warning-600 border-warning-200',
  poor: 'bg-danger-50 text-danger-600 border-danger-200',
  not_inspected: 'bg-gray-100 text-gray-500 border-gray-200',
};

const INITIAL_METER_READINGS: MeterReading[] = [
  {
    id: 'electricity',
    name: 'Electricity Meter',
    icon: Zap,
    unit: 'kWh',
    value: '',
    meterNumber: '04-123-4567-890',
    placeholder: 'e.g., 12345.6',
    required: true,
  },
  {
    id: 'water',
    name: 'Water Meter',
    icon: Droplets,
    unit: 'm\u00B3',
    value: '',
    meterNumber: 'WTR-204-A',
    placeholder: 'e.g., 456.7',
    required: true,
  },
];

export default function OnboardingInspectionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase: 'rooms' | 'meters' | 'signoff'
  const [phase, setPhase] = useState<'rooms' | 'meters' | 'signoff'>('rooms');
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [rooms, setRooms] = useState<InspectionRoom[]>(
    INSPECTION_ROOMS.map((room) => ({
      ...room,
      checkpoints: CHECKPOINT_ITEMS.slice(
        0,
        room.id === 'balcony' ? 5 : 8
      ).map((name, i) => ({
        id: `${room.id}_${i}`,
        name,
        description: '',
        photos: [],
        notes: '',
        condition: 'not_inspected' as const,
      })),
    }))
  );
  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>(INITIAL_METER_READINGS);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTips, setShowTips] = useState(true);

  const currentRoom = rooms[currentRoomIndex];
  const overallProgress =
    rooms.reduce(
      (acc, room) =>
        acc + room.checkpoints.filter((c) => c.condition !== 'not_inspected').length,
      0
    ) / rooms.reduce((acc, room) => acc + room.checkpoints.length, 0);

  // --- Photo handlers ---
  const handlePhotoCapture = (checkpointId: string, file: File) => {
    const url = URL.createObjectURL(file);
    const photoId = `photo_${Date.now()}`;
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        checkpoints: room.checkpoints.map((cp) =>
          cp.id === checkpointId
            ? { ...cp, photos: [...cp.photos, { id: photoId, url, caption: '' }] }
            : cp
        ),
      }))
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeCheckpointId) {
      handlePhotoCapture(activeCheckpointId, file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCamera = (checkpointId: string) => {
    setActiveCheckpointId(checkpointId);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const removePhoto = (checkpointId: string, photoId: string) => {
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        checkpoints: room.checkpoints.map((cp) =>
          cp.id === checkpointId
            ? { ...cp, photos: cp.photos.filter((p) => p.id !== photoId) }
            : cp
        ),
      }))
    );
  };

  const setCondition = (checkpointId: string, condition: InspectionCheckpoint['condition']) => {
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        checkpoints: room.checkpoints.map((cp) =>
          cp.id === checkpointId ? { ...cp, condition } : cp
        ),
      }))
    );
  };

  const setNotes = (checkpointId: string, notes: string) => {
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        checkpoints: room.checkpoints.map((cp) =>
          cp.id === checkpointId ? { ...cp, notes } : cp
        ),
      }))
    );
  };

  // --- Navigation ---
  const goToNextRoom = () => {
    if (currentRoomIndex < rooms.length - 1) {
      setCurrentRoomIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevRoom = () => {
    if (currentRoomIndex > 0) {
      setCurrentRoomIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- Meter readings ---
  const updateMeterReading = (id: string, value: string) => {
    // Only allow numeric input with decimal
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setMeterReadings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, value } : m))
    );
  };

  const meterReadingsValid = meterReadings
    .filter((m) => m.required)
    .every((m) => m.value.trim() !== '' && parseFloat(m.value) >= 0);

  // --- Submit ---
  const handleSubmit = async () => {
    setIsSubmitting(true);

    const meterData: Record<string, number> = {};
    meterReadings.forEach((m) => {
      if (m.value) meterData[m.id] = parseFloat(m.value);
    });

    try {
      await api.onboarding.submitInspection({
        rooms,
        meterReadings: meterData,
        signature: signature || undefined,
      });
    } catch {
      // Continue even if API fails
    }

    // Save progress
    const savedProgress = JSON.parse(localStorage.getItem('onboarding_progress') || '{}');
    savedProgress.inspection = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(savedProgress));
    localStorage.setItem('inspection_data', JSON.stringify({ rooms, meterReadings: meterData }));

    router.push('/onboarding/e-sign');
  };

  const isLastRoom = currentRoomIndex === rooms.length - 1;
  const roomProgress =
    currentRoom.checkpoints.filter((c) => c.condition !== 'not_inspected').length /
    currentRoom.checkpoints.length;

  // ====== Render: Meter Readings Phase ======
  if (phase === 'meters') {
    return (
      <>
        <PageHeader title="Meter Readings" showBack />

        <div className="px-4 py-4 space-y-6 pb-32">
          <div className="card p-4 bg-primary-50 border-primary-100">
            <div className="flex items-center gap-3">
              <Gauge className="w-5 h-5 text-primary-600" />
              <div>
                <h3 className="font-medium text-primary-900">Record Current Readings</h3>
                <p className="text-sm text-primary-700">
                  Take note of all meter readings before you move in
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {meterReadings.map((meter) => {
              const Icon = meter.icon;
              const hasValue = meter.value.trim() !== '';
              const isValid = hasValue && parseFloat(meter.value) >= 0;

              return (
                <div key={meter.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${isValid ? 'bg-success-50' : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${isValid ? 'text-success-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{meter.name}</h3>
                      <p className="text-xs text-gray-500">
                        Meter: <span className="font-mono">{meter.meterNumber}</span>
                      </p>
                    </div>
                    {isValid && <Check className="w-5 h-5 text-success-500 ml-auto" />}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={meter.value}
                      onChange={(e) => updateMeterReading(meter.id, e.target.value)}
                      placeholder={meter.placeholder}
                      className="input pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      {meter.unit}
                    </span>
                  </div>

                  {meter.required && !hasValue && (
                    <p className="text-xs text-gray-400 mt-1">
                      * Required
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <p>
              Record the exact meter readings shown on each meter. Take a photo
              of each meter for your records. These readings establish your
              starting point for utility billing.
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('rooms')}
              className="btn-secondary flex-1 py-4"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>
            <button
              onClick={() => setPhase('signoff')}
              disabled={!meterReadingsValid}
              className="btn-primary flex-1 py-4 disabled:opacity-50"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ====== Render: Sign-off Phase ======
  if (phase === 'signoff') {
    return (
      <>
        <PageHeader title="Inspection Sign-off" showBack />

        <div className="px-4 py-4 space-y-6 pb-32">
          {/* Summary */}
          <div className="card p-5">
            <h2 className="font-semibold text-lg mb-4">Inspection Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Rooms Inspected</span>
                <span className="font-medium">{rooms.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Items Checked</span>
                <span className="font-medium">
                  {rooms.reduce(
                    (acc, r) =>
                      acc + r.checkpoints.filter((c) => c.condition !== 'not_inspected').length,
                    0
                  )}{' '}
                  / {rooms.reduce((acc, r) => acc + r.checkpoints.length, 0)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Photos Taken</span>
                <span className="font-medium">
                  {rooms.reduce(
                    (acc, r) => acc + r.checkpoints.reduce((a, c) => a + c.photos.length, 0),
                    0
                  )}
                </span>
              </div>
              {meterReadings.map((m) =>
                m.value ? (
                  <div key={m.id} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">{m.name}</span>
                    <span className="font-medium font-mono">
                      {m.value} {m.unit}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Digital Signature */}
          <div className="card p-5">
            <h3 className="font-semibold mb-2">Tenant Signature</h3>
            <p className="text-sm text-gray-500 mb-4">
              By signing below, you confirm that this inspection report
              accurately reflects the condition of the unit at move-in.
            </p>
            <ESignature
              onSave={(dataUrl) => setSignature(dataUrl)}
              onClear={() => setSignature(null)}
              existingSignature={signature}
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('meters')}
              className="btn-secondary flex-1 py-4"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !signature}
              className="btn-primary flex-1 py-4 text-base font-semibold disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Complete Inspection
                  <Check className="w-5 h-5" />
                </span>
              )}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ====== Render: Room Inspection Phase ======
  return (
    <>
      <PageHeader title="Move-in Inspection" showBack />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="pb-32">
        {/* Overall Progress */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-medium">{Math.round(overallProgress * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Room Navigation */}
        <div className="px-4 py-3 bg-white border-b border-gray-200 sticky top-14 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevRoom}
              disabled={currentRoomIndex === 0}
              className="p-2 rounded-lg disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="font-semibold">{currentRoom.name}</h2>
              <p className="text-xs text-gray-500">
                Room {currentRoomIndex + 1} of {rooms.length}
              </p>
            </div>
            <button
              onClick={goToNextRoom}
              disabled={currentRoomIndex === rooms.length - 1}
              className="p-2 rounded-lg disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-success-500 rounded-full transition-all duration-300"
              style={{ width: `${roomProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Tips Banner */}
        {showTips && (
          <div className="mx-4 mt-4 card p-4 bg-primary-50 border-primary-100 relative">
            <button
              onClick={() => setShowTips(false)}
              className="absolute top-2 right-2 p-1 text-primary-400 hover:text-primary-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div className="text-sm text-primary-800">
                <p className="font-medium mb-1">Inspection Tips</p>
                <ul className="text-primary-700 space-y-1">
                  <li>Take clear, well-lit photos of any existing damage</li>
                  <li>Note any scratches, stains, or wear</li>
                  <li>Test all switches, outlets, and faucets</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Checkpoints */}
        <div className="px-4 py-4 space-y-4">
          {currentRoom.checkpoints.map((checkpoint) => (
            <div key={checkpoint.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium">{checkpoint.name}</h3>
                  {checkpoint.condition !== 'not_inspected' && (
                    <span
                      className={`badge text-xs ${
                        checkpoint.condition === 'good'
                          ? 'badge-success'
                          : checkpoint.condition === 'fair'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {checkpoint.condition.charAt(0).toUpperCase() +
                        checkpoint.condition.slice(1)}
                    </span>
                  )}
                </div>

                {/* Condition Buttons */}
                <div className="flex gap-2 mb-4">
                  {(['good', 'fair', 'poor'] as const).map((cond) => (
                    <button
                      key={cond}
                      onClick={() => setCondition(checkpoint.id, cond)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        checkpoint.condition === cond
                          ? conditionColors[cond]
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {cond.charAt(0).toUpperCase() + cond.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Photos */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                  {checkpoint.photos.map((photo) => (
                    <div key={photo.id} className="relative flex-shrink-0">
                      <img
                        src={photo.url}
                        alt=""
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => removePhoto(checkpoint.id, photo.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => openCamera(checkpoint.id)}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 flex-shrink-0"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs mt-1">Photo</span>
                  </button>
                </div>

                {/* Notes */}
                <textarea
                  placeholder="Add notes about this item..."
                  value={checkpoint.notes}
                  onChange={(e) => setNotes(checkpoint.id, e.target.value)}
                  className="input text-sm min-h-[60px]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <div className="flex gap-3">
          {currentRoomIndex > 0 && (
            <button onClick={goToPrevRoom} className="btn-secondary flex-1 py-4">
              <ChevronLeft className="w-5 h-5 mr-1" />
              Previous
            </button>
          )}
          {isLastRoom ? (
            <button
              onClick={() => {
                setPhase('meters');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={overallProgress < 0.5}
              className="btn-primary flex-1 py-4 text-base font-semibold disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-2">
                Meter Readings
                <Gauge className="w-5 h-5" />
              </span>
            </button>
          ) : (
            <button onClick={goToNextRoom} className="btn-primary flex-1 py-4">
              Next Room
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

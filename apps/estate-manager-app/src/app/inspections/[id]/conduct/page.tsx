'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Camera,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Image as ImageIcon,
  Gauge,
  PenLine,
  Save,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type InspectionType = 'move_in' | 'move_out' | 'routine' | 'pre_lease';
type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'not_applicable';

interface InspectionArea {
  id: string;
  name: string;
  description: string;
  items: InspectionItem[];
}

interface InspectionItem {
  id: string;
  name: string;
  condition: ConditionRating;
  photos: { id: string; url: string }[];
  notes: string;
  defects: string[];
  previousCondition?: ConditionRating; // For move-out comparison
}

interface MeterReading {
  type: 'electricity' | 'water' | 'gas';
  reading: string;
  unit: string;
  photo?: string;
}

const INSPECTION_AREAS: Omit<InspectionArea, 'items'>[] = [
  { id: 'entrance', name: 'Entrance & Hallway', description: 'Front door, locks, flooring, lights' },
  { id: 'living', name: 'Living Room', description: 'Walls, ceiling, windows, outlets' },
  { id: 'kitchen', name: 'Kitchen', description: 'Appliances, cabinets, plumbing, surfaces' },
  { id: 'bedroom1', name: 'Master Bedroom', description: 'Walls, flooring, closet, windows' },
  { id: 'bedroom2', name: 'Second Bedroom', description: 'Walls, flooring, closet, windows' },
  { id: 'bathroom1', name: 'Main Bathroom', description: 'Fixtures, tiles, plumbing, ventilation' },
  { id: 'bathroom2', name: 'Second Bathroom', description: 'Fixtures, tiles, plumbing, ventilation' },
  { id: 'outdoor', name: 'Balcony/Outdoor', description: 'Railings, surfaces, drainage' },
];

const AREA_ITEMS: Record<string, string[]> = {
  entrance: ['Front Door', 'Door Lock', 'Doorbell', 'Flooring', 'Light Fixtures', 'Walls', 'Ceiling'],
  living: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Window Treatments', 'Light Fixtures', 'Electrical Outlets', 'A/C Unit'],
  kitchen: ['Refrigerator', 'Stove/Oven', 'Microwave', 'Dishwasher', 'Sink & Faucet', 'Cabinets', 'Countertops', 'Flooring', 'Exhaust Fan', 'Light Fixtures'],
  bedroom1: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Closet', 'Light Fixtures', 'Electrical Outlets', 'Door & Lock'],
  bedroom2: ['Walls', 'Ceiling', 'Flooring', 'Windows', 'Closet', 'Light Fixtures', 'Electrical Outlets', 'Door & Lock'],
  bathroom1: ['Toilet', 'Sink & Faucet', 'Shower/Tub', 'Tiles', 'Mirror', 'Towel Rails', 'Exhaust Fan', 'Light Fixtures', 'Door & Lock'],
  bathroom2: ['Toilet', 'Sink & Faucet', 'Shower/Tub', 'Tiles', 'Mirror', 'Exhaust Fan', 'Light Fixtures'],
  outdoor: ['Flooring/Surface', 'Railings', 'Drainage', 'Light Fixtures', 'Door/Sliding Glass'],
};

const conditionColors: Record<ConditionRating, { bg: string; text: string; border: string }> = {
  excellent: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-300' },
  good: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-300' },
  fair: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-300' },
  poor: { bg: 'bg-danger-50', text: 'text-danger-700', border: 'border-danger-300' },
  not_applicable: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

const conditionLabels: Record<ConditionRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  not_applicable: 'N/A',
};

export default function ConductInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inspectionType] = useState<InspectionType>('move_in'); // Would come from API
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [areas, setAreas] = useState<InspectionArea[]>(() =>
    INSPECTION_AREAS.map((area) => ({
      ...area,
      items: AREA_ITEMS[area.id].map((name) => ({
        id: `${area.id}_${name.replace(/\s/g, '_').toLowerCase()}`,
        name,
        condition: 'good' as ConditionRating,
        photos: [],
        notes: '',
        defects: [],
        previousCondition: inspectionType === 'move_out' ? 'good' as ConditionRating : undefined,
      })),
    }))
  );
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([
    { type: 'electricity', reading: '', unit: 'kWh' },
    { type: 'water', reading: '', unit: 'm³' },
  ]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showMeterStep, setShowMeterStep] = useState(false);
  const [showSignatureStep, setShowSignatureStep] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTips, setShowTips] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const currentArea = areas[currentAreaIndex];
  const totalItems = areas.reduce((sum, area) => sum + area.items.length, 0);
  const completedItems = areas.reduce(
    (sum, area) => sum + area.items.filter((item) => item.condition !== 'good' || item.photos.length > 0 || item.notes).length,
    0
  );
  const progress = completedItems / totalItems;

  // Signature canvas setup
  useEffect(() => {
    if (showSignatureStep && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, [showSignatureStep]);

  const handlePhotoCapture = (itemId: string, file: File) => {
    const url = URL.createObjectURL(file);
    const photoId = `photo_${Date.now()}`;

    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        items: area.items.map((item) =>
          item.id === itemId
            ? { ...item, photos: [...item.photos, { id: photoId, url }] }
            : item
        ),
      }))
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeItemId) {
      handlePhotoCapture(activeItemId, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openCamera = (itemId: string) => {
    setActiveItemId(itemId);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const setItemCondition = (itemId: string, condition: ConditionRating) => {
    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        items: area.items.map((item) =>
          item.id === itemId ? { ...item, condition } : item
        ),
      }))
    );
  };

  const setItemNotes = (itemId: string, notes: string) => {
    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        items: area.items.map((item) =>
          item.id === itemId ? { ...item, notes } : item
        ),
      }))
    );
  };

  const removePhoto = (itemId: string, photoId: string) => {
    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        items: area.items.map((item) =>
          item.id === itemId
            ? { ...item, photos: item.photos.filter((p) => p.id !== photoId) }
            : item
        ),
      }))
    );
  };

  const goToNextArea = () => {
    if (currentAreaIndex < areas.length - 1) {
      setCurrentAreaIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowMeterStep(true);
    }
  };

  const goToPrevArea = () => {
    if (showSignatureStep) {
      setShowSignatureStep(false);
    } else if (showMeterStep) {
      setShowMeterStep(false);
    } else if (currentAreaIndex > 0) {
      setCurrentAreaIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Signature drawing
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL('image/png'));
    }
  };

  const handleSubmit = async () => {
    if (!signature) {
      saveSignature();
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API submission
    await new Promise((r) => setTimeout(r, 2000));

    // Save inspection data
    const inspectionData = {
      id: params.id,
      type: inspectionType,
      areas,
      meterReadings,
      signature,
      completedAt: new Date().toISOString(),
    };
    router.push(`/inspections/${params.id}?completed=true`);
  };

  return (
    <>
      <PageHeader title="Conduct Inspection" showBack />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Progress Bar */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 sticky top-14 z-10">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Overall Progress</span>
          <span className="font-medium">{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="pb-32">
        {/* Tips Banner */}
        {showTips && !showMeterStep && !showSignatureStep && (
          <div className="mx-4 mt-4 card p-4 bg-primary-50 border-primary-100 relative">
            <button
              onClick={() => setShowTips(false)}
              className="absolute top-2 right-2 p-1 text-primary-400"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div className="text-sm text-primary-800">
                <p className="font-medium mb-1">Inspection Tips</p>
                <ul className="text-primary-700 space-y-1 text-xs">
                  <li>• Take clear photos of any damage or defects</li>
                  <li>• Check all switches, outlets, and appliances</li>
                  <li>• Note any issues, even minor ones</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!showMeterStep && !showSignatureStep && (
          <>
            {/* Area Navigation */}
            <div className="px-4 py-3 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPrevArea}
                  disabled={currentAreaIndex === 0}
                  className="p-2 rounded-lg disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h2 className="font-semibold">{currentArea.name}</h2>
                  <p className="text-xs text-gray-500">
                    Area {currentAreaIndex + 1} of {areas.length}
                  </p>
                </div>
                <button
                  onClick={goToNextArea}
                  className="p-2 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="px-4 py-4 space-y-4">
              {currentArea.items.map((item) => {
                const colors = conditionColors[item.condition];
                const hasPreviousCondition = item.previousCondition !== undefined;
                const conditionChanged = hasPreviousCondition && item.previousCondition !== item.condition;

                return (
                  <div key={item.id} className="card overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium">{item.name}</h3>
                        {conditionChanged && (
                          <span className="badge-warning text-xs">Changed</span>
                        )}
                      </div>

                      {/* Condition Buttons */}
                      <div className="flex gap-2 mb-4">
                        {(Object.keys(conditionLabels) as ConditionRating[]).map((cond) => (
                          <button
                            key={cond}
                            onClick={() => setItemCondition(item.id, cond)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                              item.condition === cond
                                ? `${colors.bg} ${colors.text} ${colors.border}`
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {conditionLabels[cond]}
                          </button>
                        ))}
                      </div>

                      {/* Previous Condition (for move-out) */}
                      {hasPreviousCondition && (
                        <div className="text-xs text-gray-500 mb-3">
                          Move-in condition: {conditionLabels[item.previousCondition!]}
                        </div>
                      )}

                      {/* Photos */}
                      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                        {item.photos.map((photo) => (
                          <div key={photo.id} className="relative flex-shrink-0">
                            <img
                              src={photo.url}
                              alt=""
                              className="w-20 h-20 rounded-lg object-cover"
                            />
                            <button
                              onClick={() => removePhoto(item.id, photo.id)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full flex items-center justify-center text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => openCamera(item.id)}
                          className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 flex-shrink-0"
                        >
                          <Camera className="w-5 h-5" />
                          <span className="text-xs mt-1">Photo</span>
                        </button>
                      </div>

                      {/* Notes */}
                      <textarea
                        placeholder="Add notes about this item..."
                        value={item.notes}
                        onChange={(e) => setItemNotes(item.id, e.target.value)}
                        className="input text-sm min-h-[60px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Meter Readings Step */}
        {showMeterStep && !showSignatureStep && (
          <div className="px-4 py-4 space-y-6">
            <div className="text-center mb-6">
              <Gauge className="w-12 h-12 text-primary-500 mx-auto mb-2" />
              <h2 className="text-xl font-semibold">Meter Readings</h2>
              <p className="text-sm text-gray-500">Record current meter readings</p>
            </div>

            {meterReadings.map((meter, idx) => (
              <div key={meter.type} className="card p-4">
                <label className="label capitalize">{meter.type} Meter</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      className="input pr-14"
                      placeholder="Enter reading"
                      value={meter.reading}
                      onChange={(e) => {
                        const newReadings = [...meterReadings];
                        newReadings[idx].reading = e.target.value;
                        setMeterReadings(newReadings);
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {meter.unit}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveItemId(`meter_${meter.type}`);
                      fileInputRef.current?.click();
                    }}
                    className="btn-secondary"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
                {meter.photo && (
                  <div className="mt-2">
                    <img
                      src={meter.photo}
                      alt={`${meter.type} meter`}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Signature Step */}
        {showSignatureStep && (
          <div className="px-4 py-4 space-y-6">
            <div className="text-center mb-6">
              <PenLine className="w-12 h-12 text-primary-500 mx-auto mb-2" />
              <h2 className="text-xl font-semibold">Customer Signature</h2>
              <p className="text-sm text-gray-500">
                Ask the customer to sign below to confirm the inspection
              </p>
            </div>

            <div className="card p-4">
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden mb-4">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={200}
                  className="w-full touch-none bg-white"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <div className="flex gap-3">
                <button onClick={clearSignature} className="btn-secondary flex-1">
                  Clear
                </button>
                <button onClick={saveSignature} className="btn-primary flex-1">
                  <PenLine className="w-4 h-4 mr-2" />
                  Apply Signature
                </button>
              </div>
            </div>

            {signature && (
              <div className="card p-4 bg-success-50 border-success-200">
                <div className="flex items-center gap-2 text-success-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Signature captured</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <div className="flex gap-3">
          <button onClick={goToPrevArea} className="btn-secondary flex-1 py-4">
            <ChevronLeft className="w-5 h-5 mr-1" />
            Previous
          </button>
          {showSignatureStep ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !signature}
              className="btn-primary flex-1 py-4"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Complete Inspection
                </>
              )}
            </button>
          ) : showMeterStep ? (
            <button
              onClick={() => setShowSignatureStep(true)}
              className="btn-primary flex-1 py-4"
            >
              Continue to Signature
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button onClick={goToNextArea} className="btn-primary flex-1 py-4">
              {currentAreaIndex === areas.length - 1 ? 'Continue to Meters' : 'Next Area'}
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

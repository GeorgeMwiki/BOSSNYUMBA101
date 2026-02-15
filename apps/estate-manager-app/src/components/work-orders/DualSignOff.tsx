'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  X,
  PenLine,
  User,
  Wrench,
} from 'lucide-react';

interface DualSignOffProps {
  workOrder: {
    id: string;
    title: string;
    customer: { name: string };
    assignedVendor?: { name: string };
  };
  onComplete: (tenantSignature: string, technicianSignature: string) => void;
  onClose: () => void;
}

type SignOffStep = 'photos' | 'notes' | 'tenant_signature' | 'technician_signature' | 'confirm';

export function DualSignOff({ workOrder, onComplete, onClose }: DualSignOffProps) {
  const [step, setStep] = useState<SignOffStep>('photos');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [tenantSignature, setTenantSignature] = useState<string | null>(null);
  const [technicianSignature, setTechnicianSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentSigner, setCurrentSigner] = useState<'tenant' | 'technician' | null>(null);

  // Canvas signature drawing
  useEffect(() => {
    if ((step === 'tenant_signature' || step === 'technician_signature') && canvasRef.current) {
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
  }, [step]);

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
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      if (step === 'tenant_signature') {
        setTenantSignature(dataUrl);
        setStep('technician_signature');
      } else {
        setTechnicianSignature(dataUrl);
        setStep('confirm');
      }
    }
  };

  const handlePhotoAdd = (type: 'before' | 'after') => {
    // Simulate photo capture
    const newPhoto = `/photo-${Date.now()}.jpg`;
    if (type === 'before') {
      setBeforePhotos((prev) => [...prev, newPhoto]);
    } else {
      setAfterPhotos((prev) => [...prev, newPhoto]);
    }
  };

  const handleSubmit = async () => {
    if (!tenantSignature || !technicianSignature) return;
    setSubmitting(true);
    await onComplete(tenantSignature, technicianSignature);
    setSubmitting(false);
  };

  const steps = [
    { id: 'photos', label: 'Photos' },
    { id: 'notes', label: 'Notes' },
    { id: 'tenant_signature', label: 'Tenant Sign' },
    { id: 'technician_signature', label: 'Tech Sign' },
    { id: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Completion Sign-Off</h3>
            <p className="text-sm text-gray-500">{workOrder.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400">×</button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                i < currentStepIndex
                  ? 'bg-success-500 text-white'
                  : i === currentStepIndex
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {i < currentStepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-6 h-0.5 ${i < currentStepIndex ? 'bg-success-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 'photos' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Upload before and after photos to document the completed work.
            </p>

            {/* Before Photos */}
            <div>
              <label className="label">Before Photos</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {beforePhotos.map((photo, idx) => (
                  <div key={idx} className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 relative">
                    <ImageIcon className="w-6 h-6 text-gray-400 absolute inset-0 m-auto" />
                    <button
                      onClick={() => setBeforePhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full text-white"
                    >
                      <X className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handlePhotoAdd('before')}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs mt-1">Add</span>
                </button>
              </div>
            </div>

            {/* After Photos */}
            <div>
              <label className="label">After Photos (showing completed work)</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {afterPhotos.map((photo, idx) => (
                  <div key={idx} className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 relative">
                    <ImageIcon className="w-6 h-6 text-gray-400 absolute inset-0 m-auto" />
                    <button
                      onClick={() => setAfterPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full text-white"
                    >
                      <X className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handlePhotoAdd('after')}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs mt-1">Add</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setStep('notes')}
              disabled={afterPhotos.length === 0}
              className="btn-primary w-full py-3"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'notes' && (
          <div className="space-y-4">
            <div>
              <label className="label">Work Completed</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="Describe what was done..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Materials Used</label>
              <textarea
                className="input"
                placeholder="List materials and quantities..."
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Labor Hours</label>
              <input
                type="number"
                className="input"
                placeholder="e.g., 2.5"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('photos')} className="btn-secondary flex-1">
                Back
              </button>
              <button
                onClick={() => setStep('tenant_signature')}
                disabled={!notes.trim()}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {(step === 'tenant_signature' || step === 'technician_signature') && (
          <div className="space-y-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <div className="flex items-center gap-2 text-primary-700 mb-1">
                {step === 'tenant_signature' ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Wrench className="w-5 h-5" />
                )}
                <span className="font-medium">
                  {step === 'tenant_signature'
                    ? `Tenant: ${workOrder.customer.name}`
                    : `Technician: ${workOrder.assignedVendor?.name || 'Technician'}`}
                </span>
              </div>
              <p className="text-sm text-primary-600">
                {step === 'tenant_signature'
                  ? 'Please sign to confirm the work has been completed satisfactorily.'
                  : 'Please sign to confirm the work was completed as described.'}
              </p>
            </div>

            <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                width={350}
                height={150}
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

            <p className="text-xs text-gray-500 text-center">
              Sign using your finger or mouse in the box above
            </p>

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
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 bg-success-50 rounded-lg">
              <CheckCircle className="w-8 h-8 text-success-600 mx-auto mb-2" />
              <h4 className="font-medium text-success-900 text-center">Ready to Complete</h4>
              <p className="text-sm text-success-700 text-center mt-1">
                Both signatures have been captured.
              </p>
            </div>

            {/* Summary */}
            <div className="card p-4 space-y-3">
              <div>
                <div className="text-xs text-gray-500">Work Notes</div>
                <div className="text-sm">{notes}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Photos</div>
                  <div className="text-sm">{afterPhotos.length} after photos</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Labor</div>
                  <div className="text-sm">{laborHours || '0'} hours</div>
                </div>
              </div>
            </div>

            {/* Signatures Preview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-1">Tenant Signature</div>
                {tenantSignature && (
                  <img src={tenantSignature} alt="Tenant signature" className="h-12 object-contain" />
                )}
              </div>
              <div className="border rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-1">Technician Signature</div>
                {technicianSignature && (
                  <img src={technicianSignature} alt="Technician signature" className="h-12 object-contain" />
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('technician_signature')} className="btn-secondary flex-1">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Complete Work Order
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

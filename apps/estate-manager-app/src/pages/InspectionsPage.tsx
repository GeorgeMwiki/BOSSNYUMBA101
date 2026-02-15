'use client';

import { useState, useRef } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Edit3,
  Image,
  Plus,
  Save,
  Trash2,
  X,
  AlertCircle,
  Building,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Types
interface ChecklistItem {
  id: string;
  label: string;
  status: 'pending' | 'pass' | 'fail' | 'na';
  notes?: string;
  photos: string[];
}

interface ChecklistCategory {
  id: string;
  name: string;
  items: ChecklistItem[];
  expanded: boolean;
}

interface Inspection {
  id: string;
  property: string;
  unit: string;
  type: 'move_in' | 'move_out' | 'routine' | 'quarterly';
  scheduledDate: Date;
  status: 'scheduled' | 'in_progress' | 'completed';
  tenant?: string;
}

// Mock Data
const initialCategories: ChecklistCategory[] = [
  {
    id: '1',
    name: 'Living Room',
    expanded: true,
    items: [
      { id: '1-1', label: 'Walls - Check for cracks, holes, stains', status: 'pending', photos: [] },
      { id: '1-2', label: 'Ceiling - Check for water damage, cracks', status: 'pending', photos: [] },
      { id: '1-3', label: 'Flooring - Check condition, scratches', status: 'pending', photos: [] },
      { id: '1-4', label: 'Windows - Check glass, frames, locks', status: 'pending', photos: [] },
      { id: '1-5', label: 'Electrical outlets - Test functionality', status: 'pending', photos: [] },
      { id: '1-6', label: 'Light fixtures - Test all switches', status: 'pending', photos: [] },
    ],
  },
  {
    id: '2',
    name: 'Kitchen',
    expanded: false,
    items: [
      { id: '2-1', label: 'Cabinets - Check doors, hinges, interior', status: 'pending', photos: [] },
      { id: '2-2', label: 'Countertops - Check for damage, stains', status: 'pending', photos: [] },
      { id: '2-3', label: 'Sink & Faucet - Check for leaks, drainage', status: 'pending', photos: [] },
      { id: '2-4', label: 'Stove/Oven - Test all burners, oven', status: 'pending', photos: [] },
      { id: '2-5', label: 'Refrigerator - Check cooling, seals', status: 'pending', photos: [] },
      { id: '2-6', label: 'Exhaust fan - Test functionality', status: 'pending', photos: [] },
    ],
  },
  {
    id: '3',
    name: 'Bathroom',
    expanded: false,
    items: [
      { id: '3-1', label: 'Toilet - Check flush, seals, stability', status: 'pending', photos: [] },
      { id: '3-2', label: 'Sink & Faucet - Check for leaks', status: 'pending', photos: [] },
      { id: '3-3', label: 'Shower/Tub - Check tiles, grout, drain', status: 'pending', photos: [] },
      { id: '3-4', label: 'Mirror & Medicine cabinet - Check condition', status: 'pending', photos: [] },
      { id: '3-5', label: 'Ventilation - Test exhaust fan', status: 'pending', photos: [] },
      { id: '3-6', label: 'Towel bars & accessories - Check mounting', status: 'pending', photos: [] },
    ],
  },
  {
    id: '4',
    name: 'Bedroom',
    expanded: false,
    items: [
      { id: '4-1', label: 'Walls - Check for damage', status: 'pending', photos: [] },
      { id: '4-2', label: 'Closet - Check doors, shelving, rod', status: 'pending', photos: [] },
      { id: '4-3', label: 'Windows - Check operation, locks', status: 'pending', photos: [] },
      { id: '4-4', label: 'Flooring - Check condition', status: 'pending', photos: [] },
      { id: '4-5', label: 'Electrical - Test outlets, switches', status: 'pending', photos: [] },
    ],
  },
  {
    id: '5',
    name: 'Exterior & Common Areas',
    expanded: false,
    items: [
      { id: '5-1', label: 'Entry door - Check lock, hinges, frame', status: 'pending', photos: [] },
      { id: '5-2', label: 'Balcony/Patio - Check railing, floor', status: 'pending', photos: [] },
      { id: '5-3', label: 'Parking space - Check condition', status: 'pending', photos: [] },
      { id: '5-4', label: 'Storage unit - If applicable', status: 'pending', photos: [] },
    ],
  },
];

const mockInspections: Inspection[] = [
  {
    id: '1',
    property: 'Sunset Apartments',
    unit: 'Unit 4B',
    type: 'move_in',
    scheduledDate: new Date(),
    status: 'in_progress',
    tenant: 'John Mwangi',
  },
  {
    id: '2',
    property: 'Sunrise Estate',
    unit: 'Block A',
    type: 'quarterly',
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'scheduled',
  },
  {
    id: '3',
    property: 'Green Gardens',
    unit: 'Unit 2C',
    type: 'move_out',
    scheduledDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status: 'scheduled',
    tenant: 'Mary Wanjiku',
  },
];

export default function InspectionsPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'checklist'>('list');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [categories, setCategories] = useState<ChecklistCategory[]>(initialCategories);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleCategory = (categoryId: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, expanded: !cat.expanded } : cat
      )
    );
  };

  const updateItemStatus = (categoryId: string, itemId: string, status: ChecklistItem['status']) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId ? { ...item, status } : item
              ),
            }
          : cat
      )
    );
  };

  const updateItemNotes = (categoryId: string, itemId: string, notes: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId ? { ...item, notes } : item
              ),
            }
          : cat
      )
    );
  };

  const handlePhotoCapture = (categoryId: string, itemId: string) => {
    setActiveItemId(`${categoryId}-${itemId}`);
    setShowPhotoModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeItemId) return;

    const [categoryId, itemId] = activeItemId.split('-');
    const reader = new FileReader();
    reader.onload = (event) => {
      const photoUrl = event.target?.result as string;
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                items: cat.items.map((item) =>
                  item.id === `${categoryId}-${itemId}`
                    ? { ...item, photos: [...item.photos, photoUrl] }
                    : item
                ),
              }
            : cat
        )
      );
    };
    reader.readAsDataURL(files[0]);
    setShowPhotoModal(false);
  };

  const removePhoto = (categoryId: string, itemId: string, photoIndex: number) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId
                  ? { ...item, photos: item.photos.filter((_, i) => i !== photoIndex) }
                  : item
              ),
            }
          : cat
      )
    );
  };

  // Signature Pad Functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL();
    setSignature(signatureData);
    setShowSignaturePad(false);
  };

  const getProgress = () => {
    const allItems = categories.flatMap((c) => c.items);
    const completed = allItems.filter((i) => i.status !== 'pending').length;
    return Math.round((completed / allItems.length) * 100);
  };

  const getStatusColor = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-emerald-500 text-white';
      case 'fail':
        return 'bg-red-500 text-white';
      case 'na':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };

  const getTypeLabel = (type: Inspection['type']) => {
    switch (type) {
      case 'move_in':
        return 'Move-In';
      case 'move_out':
        return 'Move-Out';
      case 'routine':
        return 'Routine';
      case 'quarterly':
        return 'Quarterly';
    }
  };

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={selectedInspection ? `${selectedInspection.unit} - ${getTypeLabel(selectedInspection.type)}` : `${mockInspections.length} scheduled`}
        action={
          <button className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
          </button>
        }
      />

      {/* Tab Navigation */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('list');
              setSelectedInspection(null);
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'checklist'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            Checklist
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Inspection List */}
        {activeTab === 'list' && (
          <div className="space-y-3">
            {mockInspections.map((inspection) => (
              <div
                key={inspection.id}
                onClick={() => {
                  setSelectedInspection(inspection);
                  if (inspection.status === 'in_progress') {
                    setActiveTab('checklist');
                  }
                }}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span
                      className={`badge text-xs ${
                        inspection.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : inspection.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {getTypeLabel(inspection.type)}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900">{inspection.unit}</h3>
                <p className="text-sm text-gray-500">{inspection.property}</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {inspection.scheduledDate.toLocaleDateString()}
                  </span>
                  {inspection.tenant && (
                    <span className="text-xs text-gray-500">
                      Tenant: {inspection.tenant}
                    </span>
                  )}
                </div>
                {inspection.status === 'in_progress' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{getProgress()}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${getProgress()}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Checklist View */}
        {activeTab === 'checklist' && (
          <>
            {/* Progress Bar */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Inspection Progress</span>
                <span className="text-sm font-bold text-primary-600">{getProgress()}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{categories.flatMap((c) => c.items).filter((i) => i.status !== 'pending').length} completed</span>
                <span>{categories.flatMap((c) => c.items).filter((i) => i.status === 'fail').length} issues found</span>
              </div>
            </div>

            {/* Checklist Categories */}
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="card overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full p-4 flex items-center justify-between bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="w-5 h-5 text-primary-600" />
                      <span className="font-medium">{category.name}</span>
                      <span className="text-xs text-gray-500">
                        {category.items.filter((i) => i.status !== 'pending').length}/
                        {category.items.length}
                      </span>
                    </div>
                    {category.expanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {category.expanded && (
                    <div className="divide-y divide-gray-100">
                      {category.items.map((item) => (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="text-sm text-gray-700">{item.label}</p>
                              
                              {/* Status Buttons */}
                              <div className="flex gap-2 mt-3">
                                {(['pass', 'fail', 'na'] as const).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => updateItemStatus(category.id, item.id, status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      item.status === status
                                        ? getStatusColor(status)
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {status === 'pass' && <Check className="w-3 h-3 inline mr-1" />}
                                    {status === 'fail' && <X className="w-3 h-3 inline mr-1" />}
                                    {status.toUpperCase()}
                                  </button>
                                ))}
                              </div>

                              {/* Notes */}
                              {item.status === 'fail' && (
                                <div className="mt-3">
                                  <textarea
                                    placeholder="Add notes about the issue..."
                                    value={item.notes || ''}
                                    onChange={(e) => updateItemNotes(category.id, item.id, e.target.value)}
                                    className="input text-sm min-h-[60px]"
                                  />
                                </div>
                              )}

                              {/* Photos */}
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handlePhotoCapture(category.id, item.id.split('-')[1])}
                                  className="btn-secondary text-xs py-1.5 px-3"
                                >
                                  <Camera className="w-4 h-4" />
                                  Add Photo
                                </button>
                                {item.photos.length > 0 && (
                                  <span className="text-xs text-gray-500 flex items-center">
                                    <Image className="w-3 h-3 mr-1" />
                                    {item.photos.length} photo(s)
                                  </span>
                                )}
                              </div>

                              {/* Photo Thumbnails */}
                              {item.photos.length > 0 && (
                                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                                  {item.photos.map((photo, idx) => (
                                    <div key={idx} className="relative flex-shrink-0">
                                      <img
                                        src={photo}
                                        alt={`Photo ${idx + 1}`}
                                        className="w-16 h-16 object-cover rounded-lg"
                                      />
                                      <button
                                        onClick={() => removePhoto(category.id, item.id, idx)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* General Notes */}
            <div className="card p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                General Notes
              </h3>
              <textarea
                placeholder="Add any general observations or notes..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="input text-sm min-h-[100px]"
              />
            </div>

            {/* Signature Section */}
            <div className="card p-4">
              <h3 className="font-medium mb-3">Signature</h3>
              {signature ? (
                <div className="relative">
                  <img
                    src={signature}
                    alt="Signature"
                    className="w-full h-32 object-contain bg-gray-50 rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setSignature(null);
                      setShowSignaturePad(true);
                    }}
                    className="absolute top-2 right-2 btn-secondary text-xs"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignaturePad(true)}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors"
                >
                  <Edit3 className="w-5 h-5 mr-2" />
                  Tap to sign
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button className="btn-primary w-full py-3">
              <Save className="w-5 h-5" />
              Complete Inspection
            </button>
          </>
        )}
      </div>

      {/* Photo Capture Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Add Photo</h2>
              <button onClick={() => setShowPhotoModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full btn-primary py-4"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full btn-secondary py-4"
              >
                <Image className="w-5 h-5" />
                Choose from Gallery
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Sign Below</h2>
              <button onClick={() => setShowSignaturePad(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={200}
                  className="w-full bg-gray-50 touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={clearSignature} className="btn-secondary flex-1">
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
                <button onClick={saveSignature} className="btn-primary flex-1">
                  <Check className="w-4 h-4" />
                  Save Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

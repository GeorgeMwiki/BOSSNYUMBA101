'use client';

import { useState, useEffect } from 'react';
import {
  Star,
  Clock,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Phone,
  MessageSquare,
  ChevronRight,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  company: string;
  phone: string;
  specializations: string[];
  rating: number;
  completedJobs: number;
  responseTime: string;
  avgCost: number;
  isAvailable: boolean;
  lastJobDate?: string;
  badges: string[];
  aiScore: number;
  aiReason: string;
}

interface VendorRecommendationProps {
  category: string;
  priority: string;
  onAssign: (vendorId: string, overrideReason?: string) => void;
  onClose: () => void;
  currentVendorId?: string;
}

// Mock recommended vendors
const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'Peter Ochieng',
    company: 'Quick Fix Plumbing',
    phone: '+254 723 456 789',
    specializations: ['Plumbing', 'Gas Appliances', 'Water Heaters'],
    rating: 4.8,
    completedJobs: 156,
    responseTime: '1.5 hours',
    avgCost: 7500,
    isAvailable: true,
    badges: ['Top Rated', 'Fast Response'],
    aiScore: 95,
    aiReason: 'Best match based on specialty, availability, and performance history.',
  },
  {
    id: 'v2',
    name: 'James Mwangi',
    company: 'Reliable Plumbers',
    phone: '+254 734 567 890',
    specializations: ['Plumbing', 'Drainage', 'Water Tanks'],
    rating: 4.5,
    completedJobs: 89,
    responseTime: '3 hours',
    avgCost: 6500,
    isAvailable: true,
    badges: ['Budget Friendly'],
    aiScore: 78,
    aiReason: 'Good alternative with lower cost, but longer response time.',
  },
  {
    id: 'v3',
    name: 'David Kipchoge',
    company: 'Express Maintenance',
    phone: '+254 745 678 901',
    specializations: ['Plumbing', 'Electrical', 'HVAC'],
    rating: 4.2,
    completedJobs: 234,
    responseTime: '4 hours',
    avgCost: 8000,
    isAvailable: false,
    lastJobDate: '2024-02-12',
    badges: ['Multi-skilled'],
    aiScore: 65,
    aiReason: 'Currently unavailable. Next available tomorrow.',
  },
];

export function VendorRecommendation({
  category,
  priority,
  onAssign,
  onClose,
  currentVendorId,
}: VendorRecommendationProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showOverrideReason, setShowOverrideReason] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    // Simulate API fetch with AI recommendations
    const timer = setTimeout(() => {
      setVendors(MOCK_VENDORS);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [category, priority]);

  const aiRecommended = vendors.find((v) => v.aiScore >= 90);
  const isOverride = selectedVendor && selectedVendor !== aiRecommended?.id;

  const handleAssign = async () => {
    if (!selectedVendor) return;
    
    if (isOverride && !overrideReason.trim()) {
      setShowOverrideReason(true);
      return;
    }

    setAssigning(true);
    await onAssign(selectedVendor, isOverride ? overrideReason : undefined);
    setAssigning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Assign Vendor</h3>
            <p className="text-sm text-gray-500">
              AI-recommended vendors for {category}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400">×</button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Finding best vendors...</p>
          </div>
        ) : (
          <>
            {/* AI Recommendation Banner */}
            {aiRecommended && (
              <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
                <div className="flex items-center gap-2 text-primary-700 mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium text-sm">AI Recommendation</span>
                </div>
                <p className="text-sm text-primary-600">{aiRecommended.aiReason}</p>
              </div>
            )}

            {/* Vendor List */}
            <div className="space-y-3">
              {vendors.map((vendor) => {
                const isSelected = selectedVendor === vendor.id;
                const isRecommended = vendor.aiScore >= 90;

                return (
                  <button
                    key={vendor.id}
                    onClick={() => vendor.isAvailable && setSelectedVendor(vendor.id)}
                    disabled={!vendor.isAvailable}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : vendor.isAvailable
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-100 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{vendor.name}</span>
                          {isRecommended && (
                            <span className="badge-primary text-xs">
                              <Sparkles className="w-3 h-3 mr-1 inline" />
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{vendor.company}</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="font-medium">{vendor.rating}</span>
                        <span className="text-gray-400">({vendor.completedJobs})</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {vendor.responseTime}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <DollarSign className="w-3 h-3" />
                        ~KES {vendor.avgCost.toLocaleString()}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1">
                      {vendor.badges.map((badge) => (
                        <span key={badge} className="badge-gray text-xs">{badge}</span>
                      ))}
                      {!vendor.isAvailable && (
                        <span className="badge-warning text-xs">
                          <Clock className="w-3 h-3 mr-1 inline" />
                          Unavailable
                        </span>
                      )}
                    </div>

                    {/* AI Score Bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Match Score</span>
                        <span className="font-medium">{vendor.aiScore}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            vendor.aiScore >= 90
                              ? 'bg-success-500'
                              : vendor.aiScore >= 70
                              ? 'bg-primary-500'
                              : 'bg-warning-500'
                          }`}
                          style={{ width: `${vendor.aiScore}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Override Warning */}
            {isOverride && !showOverrideReason && (
              <div className="p-3 bg-warning-50 rounded-lg text-sm text-warning-700">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                You&apos;re selecting a vendor other than the AI recommendation. 
                You&apos;ll need to provide a reason.
              </div>
            )}

            {/* Override Reason Input */}
            {showOverrideReason && (
              <div className="p-4 border border-warning-200 rounded-xl bg-warning-50">
                <label className="block text-sm font-medium text-warning-900 mb-2">
                  Reason for overriding AI recommendation
                </label>
                <textarea
                  className="input bg-white"
                  placeholder="e.g., Tenant specifically requested this vendor, special equipment needed..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1 py-3">
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedVendor || assigning}
                className="btn-primary flex-1 py-3"
              >
                {assigning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Assign Vendor</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  Building,
  ChevronRight,
  Filter,
  Grid3X3,
  Home,
  List,
  Mail,
  Phone,
  Search,
  User,
  Users,
  X,
  Calendar,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Types
type UnitStatus = 'occupied' | 'vacant' | 'notice' | 'maintenance' | 'reserved';

interface Unit {
  id: string;
  unitNumber: string;
  property: string;
  propertyId: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  rent: number;
  status: UnitStatus;
  tenant?: Tenant;
  availableFrom?: Date;
  maintenanceNote?: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  leaseStart: Date;
  leaseEnd: Date;
  rentPaid: boolean;
  balance: number;
  moveInDate: Date;
}

interface Property {
  id: string;
  name: string;
  totalUnits: number;
  occupied: number;
  vacant: number;
  notice: number;
}

// Mock Data
const mockProperties: Property[] = [
  { id: '1', name: 'Sunset Apartments', totalUnits: 24, occupied: 20, vacant: 2, notice: 2 },
  { id: '2', name: 'Sunrise Estate', totalUnits: 16, occupied: 14, vacant: 1, notice: 1 },
  { id: '3', name: 'Green Gardens', totalUnits: 12, occupied: 10, vacant: 2, notice: 0 },
];

const mockUnits: Unit[] = [
  {
    id: '1',
    unitNumber: '1A',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 2,
    bathrooms: 1,
    sqft: 850,
    rent: 35000,
    status: 'occupied',
    tenant: {
      id: 't1',
      name: 'John Mwangi',
      email: 'john.mwangi@email.com',
      phone: '+254 712 345 678',
      leaseStart: new Date('2023-06-01'),
      leaseEnd: new Date('2024-05-31'),
      rentPaid: true,
      balance: 0,
      moveInDate: new Date('2023-06-01'),
    },
  },
  {
    id: '2',
    unitNumber: '1B',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 1,
    bathrooms: 1,
    sqft: 650,
    rent: 28000,
    status: 'vacant',
    availableFrom: new Date(),
  },
  {
    id: '3',
    unitNumber: '2A',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1100,
    rent: 45000,
    status: 'notice',
    tenant: {
      id: 't2',
      name: 'Mary Wanjiku',
      email: 'mary.wanjiku@email.com',
      phone: '+254 722 987 654',
      leaseStart: new Date('2023-01-01'),
      leaseEnd: new Date('2024-03-15'),
      rentPaid: false,
      balance: 45000,
      moveInDate: new Date('2023-01-01'),
    },
  },
  {
    id: '4',
    unitNumber: '2B',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 2,
    bathrooms: 1,
    sqft: 850,
    rent: 35000,
    status: 'maintenance',
    maintenanceNote: 'Bathroom renovation in progress',
  },
  {
    id: '5',
    unitNumber: '3A',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Studio',
    bedrooms: 0,
    bathrooms: 1,
    sqft: 450,
    rent: 18000,
    status: 'reserved',
    availableFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '6',
    unitNumber: '3B',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 2,
    bathrooms: 1,
    sqft: 850,
    rent: 35000,
    status: 'occupied',
    tenant: {
      id: 't3',
      name: 'Peter Otieno',
      email: 'peter.otieno@email.com',
      phone: '+254 733 456 789',
      leaseStart: new Date('2023-09-01'),
      leaseEnd: new Date('2024-08-31'),
      rentPaid: true,
      balance: 0,
      moveInDate: new Date('2023-09-01'),
    },
  },
  {
    id: '7',
    unitNumber: '4A',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 1,
    bathrooms: 1,
    sqft: 650,
    rent: 28000,
    status: 'occupied',
    tenant: {
      id: 't4',
      name: 'Jane Achieng',
      email: 'jane.achieng@email.com',
      phone: '+254 744 234 567',
      leaseStart: new Date('2023-04-01'),
      leaseEnd: new Date('2024-03-31'),
      rentPaid: false,
      balance: 56000,
      moveInDate: new Date('2023-04-01'),
    },
  },
  {
    id: '8',
    unitNumber: '4B',
    property: 'Sunset Apartments',
    propertyId: '1',
    type: 'Apartment',
    bedrooms: 2,
    bathrooms: 2,
    sqft: 950,
    rent: 40000,
    status: 'occupied',
    tenant: {
      id: 't5',
      name: 'Samuel Kiprop',
      email: 'samuel.kiprop@email.com',
      phone: '+254 755 876 543',
      leaseStart: new Date('2023-07-01'),
      leaseEnd: new Date('2024-06-30'),
      rentPaid: true,
      balance: 0,
      moveInDate: new Date('2023-07-01'),
    },
  },
];

// Onboarding Modal Component
function OnboardingModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [tenantInfo, setTenantInfo] = useState({
    name: '',
    email: '',
    phone: '',
    idNumber: '',
  });
  const [leaseInfo, setLeaseInfo] = useState({
    startDate: '',
    endDate: '',
    monthlyRent: unit.rent.toString(),
    deposit: (unit.rent * 2).toString(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Start Tenant Onboarding</h2>
            <p className="text-sm text-gray-500">Unit {unit.unitNumber} • {unit.property}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-primary-500 text-white' : step > s ? 'bg-success-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`h-1 flex-1 mx-2 rounded ${step > s ? 'bg-success-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {step === 1 && (
            <>
              <h3 className="font-medium">Tenant Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter tenant's full name"
                    value={tenantInfo.name}
                    onChange={(e) => setTenantInfo({ ...tenantInfo, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="tenant@email.com"
                    value={tenantInfo.email}
                    onChange={(e) => setTenantInfo({ ...tenantInfo, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Phone Number *</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+254 7XX XXX XXX"
                    value={tenantInfo.phone}
                    onChange={(e) => setTenantInfo({ ...tenantInfo, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">ID/Passport Number *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="National ID or Passport"
                    value={tenantInfo.idNumber}
                    onChange={(e) => setTenantInfo({ ...tenantInfo, idNumber: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="font-medium">Lease Details</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Lease Start Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={leaseInfo.startDate}
                      onChange={(e) => setLeaseInfo({ ...leaseInfo, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Lease End Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={leaseInfo.endDate}
                      onChange={(e) => setLeaseInfo({ ...leaseInfo, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Monthly Rent (KES)</label>
                  <input
                    type="number"
                    className="input"
                    value={leaseInfo.monthlyRent}
                    onChange={(e) => setLeaseInfo({ ...leaseInfo, monthlyRent: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Security Deposit (KES)</label>
                  <input
                    type="number"
                    className="input"
                    value={leaseInfo.deposit}
                    onChange={(e) => setLeaseInfo({ ...leaseInfo, deposit: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="font-medium">Onboarding Actions</h3>
              <div className="space-y-3">
                <div className="p-4 bg-primary-50 rounded-xl">
                  <h4 className="font-medium text-primary-900 mb-2">What happens next?</h4>
                  <ul className="space-y-2 text-sm text-primary-700">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-primary-200 rounded-full flex items-center justify-center text-xs">1</span>
                      <span>WhatsApp invitation sent to tenant</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-primary-200 rounded-full flex items-center justify-center text-xs">2</span>
                      <span>Tenant uploads documents via app</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-primary-200 rounded-full flex items-center justify-center text-xs">3</span>
                      <span>Move-in inspection scheduled</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-primary-200 rounded-full flex items-center justify-center text-xs">4</span>
                      <span>Lease e-signed by both parties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-primary-200 rounded-full flex items-center justify-center text-xs">5</span>
                      <span>Keys handed over, move-in complete</span>
                    </li>
                  </ul>
                </div>

                <div className="card p-4">
                  <h4 className="font-medium mb-2">Summary</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Tenant</dt>
                      <dd className="font-medium">{tenantInfo.name || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Phone</dt>
                      <dd className="font-medium">{tenantInfo.phone || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Lease Period</dt>
                      <dd className="font-medium">
                        {leaseInfo.startDate && leaseInfo.endDate 
                          ? `${new Date(leaseInfo.startDate).toLocaleDateString()} - ${new Date(leaseInfo.endDate).toLocaleDateString()}`
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Monthly Rent</dt>
                      <dd className="font-medium">KES {parseInt(leaseInfo.monthlyRent).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3">
          {step > 1 && (
            <button className="btn-secondary flex-1" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button className="btn-primary flex-1" onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button 
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Start Onboarding'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Move-Out Modal Component
function MoveOutModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [moveOutDate, setMoveOutDate] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [checklist, setChecklist] = useState({
    keysReturned: false,
    utilitiesFinal: false,
    inspectionScheduled: false,
    depositCalculated: false,
    cleaningRequired: false,
    repairsRequired: false,
  });
  const [depositDeductions, setDepositDeductions] = useState({
    cleaning: 0,
    repairs: 0,
    utilities: 0,
    other: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const depositAmount = unit.rent * 2; // Assuming 2 months deposit
  const totalDeductions = Object.values(depositDeductions).reduce((a, b) => a + b, 0);
  const refundAmount = depositAmount - totalDeductions;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Process Move-Out</h2>
            <p className="text-sm text-gray-500">
              {unit.tenant?.name} • Unit {unit.unitNumber}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-primary-500 text-white' : step > s ? 'bg-success-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`h-1 flex-1 mx-2 rounded ${step > s ? 'bg-success-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {step === 1 && (
            <>
              <h3 className="font-medium">Move-Out Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Move-Out Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={moveOutDate}
                    onChange={(e) => setMoveOutDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Final Inspection Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                  />
                </div>
                <div className="card bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Lease ends:</strong> {unit.tenant?.leaseEnd.toLocaleDateString()}
                  </p>
                </div>
              </div>

              <h3 className="font-medium mt-6">Move-Out Checklist</h3>
              <div className="space-y-2">
                {Object.entries({
                  keysReturned: 'All keys returned',
                  utilitiesFinal: 'Final utility readings recorded',
                  inspectionScheduled: 'Move-out inspection scheduled',
                  depositCalculated: 'Deposit refund calculated',
                  cleaningRequired: 'Professional cleaning required',
                  repairsRequired: 'Repairs required',
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 w-5 h-5"
                      checked={checklist[key as keyof typeof checklist]}
                      onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="font-medium">Deposit Calculation</h3>
              <div className="card bg-gray-50 p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Security Deposit Held</span>
                  <span className="font-bold text-lg">KES {depositAmount.toLocaleString()}</span>
                </div>
              </div>

              <h4 className="text-sm font-medium text-gray-700 mb-2">Deductions</h4>
              <div className="space-y-3">
                <div>
                  <label className="label">Cleaning Charges (KES)</label>
                  <input
                    type="number"
                    className="input"
                    value={depositDeductions.cleaning || ''}
                    onChange={(e) => setDepositDeductions({ ...depositDeductions, cleaning: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Repair Charges (KES)</label>
                  <input
                    type="number"
                    className="input"
                    value={depositDeductions.repairs || ''}
                    onChange={(e) => setDepositDeductions({ ...depositDeductions, repairs: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Utility Arrears (KES)</label>
                  <input
                    type="number"
                    className="input"
                    value={depositDeductions.utilities || ''}
                    onChange={(e) => setDepositDeductions({ ...depositDeductions, utilities: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Other Deductions (KES)</label>
                  <input
                    type="number"
                    className="input"
                    value={depositDeductions.other || ''}
                    onChange={(e) => setDepositDeductions({ ...depositDeductions, other: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="card bg-success-50 p-4 mt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-success-700 text-sm">Refund Amount</span>
                    <p className="font-bold text-2xl text-success-800">
                      KES {refundAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Deposit: KES {depositAmount.toLocaleString()}</p>
                    <p>Deductions: KES {totalDeductions.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="font-medium">Confirm Move-Out</h3>
              <div className="card p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tenant</span>
                  <span className="font-medium">{unit.tenant?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Unit</span>
                  <span className="font-medium">{unit.unitNumber} • {unit.property}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Move-Out Date</span>
                  <span className="font-medium">{moveOutDate ? new Date(moveOutDate).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Inspection Date</span>
                  <span className="font-medium">{inspectionDate ? new Date(inspectionDate).toLocaleDateString() : '—'}</span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Deposit Refund</span>
                    <span className="font-bold text-success-600">KES {refundAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary-50 rounded-xl">
                <h4 className="font-medium text-primary-900 mb-2">After move-out:</h4>
                <ul className="space-y-1 text-sm text-primary-700">
                  <li>• Unit status will change to "Vacant"</li>
                  <li>• Deposit refund will be processed</li>
                  <li>• Turnover tasks will be created</li>
                  <li>• Unit will be listed for new tenants</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3">
          {step > 1 && (
            <button className="btn-secondary flex-1" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button className="btn-primary flex-1" onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button 
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Complete Move-Out'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OccupancyPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Onboarding & Move-out modals
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingUnit, setOnboardingUnit] = useState<Unit | null>(null);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [moveOutUnit, setMoveOutUnit] = useState<Unit | null>(null);

  const filteredUnits = mockUnits.filter((unit) => {
    const matchesProperty = selectedProperty === 'all' || unit.propertyId === selectedProperty;
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      unit.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.tenant?.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesProperty && matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: UnitStatus) => {
    switch (status) {
      case 'occupied':
        return 'bg-emerald-500';
      case 'vacant':
        return 'bg-blue-500';
      case 'notice':
        return 'bg-amber-500';
      case 'maintenance':
        return 'bg-red-500';
      case 'reserved':
        return 'bg-purple-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBgColor = (status: UnitStatus) => {
    switch (status) {
      case 'occupied':
        return 'bg-emerald-50 border-emerald-200';
      case 'vacant':
        return 'bg-blue-50 border-blue-200';
      case 'notice':
        return 'bg-amber-50 border-amber-200';
      case 'maintenance':
        return 'bg-red-50 border-red-200';
      case 'reserved':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: UnitStatus) => {
    switch (status) {
      case 'occupied':
        return 'Occupied';
      case 'vacant':
        return 'Vacant';
      case 'notice':
        return 'Notice';
      case 'maintenance':
        return 'Maintenance';
      case 'reserved':
        return 'Reserved';
    }
  };

  const totalStats = {
    total: mockUnits.length,
    occupied: mockUnits.filter((u) => u.status === 'occupied').length,
    vacant: mockUnits.filter((u) => u.status === 'vacant').length,
    notice: mockUnits.filter((u) => u.status === 'notice').length,
    maintenance: mockUnits.filter((u) => u.status === 'maintenance').length,
  };

  const occupancyRate = Math.round((totalStats.occupied / totalStats.total) * 100);

  return (
    <>
      <PageHeader
        title="Occupancy"
        subtitle={`${occupancyRate}% occupied`}
        action={
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            <Filter className="w-4 h-4" />
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Occupancy Summary */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Overall Occupancy</h3>
            <span className="text-2xl font-bold text-primary-600">{occupancyRate}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(totalStats.occupied / totalStats.total) * 100}%` }}
            />
            <div
              className="h-full bg-amber-500"
              style={{ width: `${(totalStats.notice / totalStats.total) * 100}%` }}
            />
            <div
              className="h-full bg-red-500"
              style={{ width: `${(totalStats.maintenance / totalStats.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {totalStats.occupied} Occupied
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {totalStats.vacant} Vacant
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {totalStats.notice} Notice
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search units or tenants..."
            className="input pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Property</label>
              <select
                className="input"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
              >
                <option value="all">All Properties</option>
                {mockProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="occupied">Occupied</option>
                <option value="vacant">Vacant</option>
                <option value="notice">Notice</option>
                <option value="maintenance">Maintenance</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`btn flex-1 text-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn flex-1 text-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <List className="w-4 h-4" />
            List
          </button>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-2">
          {(['occupied', 'vacant', 'notice', 'maintenance', 'reserved'] as UnitStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === status
                    ? `${getStatusColor(status)} text-white`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                {getStatusLabel(status)}
              </button>
            )
          )}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-4 gap-2">
            {filteredUnits.map((unit) => (
              <button
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all hover:scale-105 ${getStatusBgColor(
                  unit.status
                )}`}
              >
                <span className="font-bold text-gray-900">{unit.unitNumber}</span>
                <span className={`w-2 h-2 rounded-full mt-1 ${getStatusColor(unit.status)}`} />
              </button>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-3">
            {filteredUnits.map((unit) => (
              <div
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${getStatusBgColor(
                        unit.status
                      )}`}
                    >
                      <Home className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Unit {unit.unitNumber}</h3>
                      <p className="text-xs text-gray-500">{unit.property}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-xs ${
                        unit.status === 'occupied'
                          ? 'bg-emerald-100 text-emerald-700'
                          : unit.status === 'vacant'
                          ? 'bg-blue-100 text-blue-700'
                          : unit.status === 'notice'
                          ? 'bg-amber-100 text-amber-700'
                          : unit.status === 'maintenance'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {getStatusLabel(unit.status)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    {unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms} bed`}
                  </span>
                  <span>{unit.bathrooms} bath</span>
                  <span>{unit.sqft} sqft</span>
                  <span className="font-medium text-gray-900">
                    KES {unit.rent.toLocaleString()}/mo
                  </span>
                </div>

                {unit.tenant && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">{unit.tenant.name}</span>
                    </div>
                    {unit.tenant.balance > 0 && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        KES {unit.tenant.balance.toLocaleString()} due
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {filteredUnits.length === 0 && (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No units found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Unit Detail Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Unit {selectedUnit.unitNumber}</h2>
                <p className="text-sm text-gray-500">{selectedUnit.property}</p>
              </div>
              <button onClick={() => setSelectedUnit(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span
                  className={`badge ${
                    selectedUnit.status === 'occupied'
                      ? 'bg-emerald-100 text-emerald-700'
                      : selectedUnit.status === 'vacant'
                      ? 'bg-blue-100 text-blue-700'
                      : selectedUnit.status === 'notice'
                      ? 'bg-amber-100 text-amber-700'
                      : selectedUnit.status === 'maintenance'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {getStatusLabel(selectedUnit.status)}
                </span>
                {selectedUnit.maintenanceNote && (
                  <span className="text-xs text-gray-500">{selectedUnit.maintenanceNote}</span>
                )}
              </div>

              {/* Unit Details */}
              <div className="card bg-gray-50 p-4">
                <h3 className="font-medium mb-3">Unit Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Type</span>
                    <p className="font-medium">{selectedUnit.type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Size</span>
                    <p className="font-medium">{selectedUnit.sqft} sqft</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Bedrooms</span>
                    <p className="font-medium">
                      {selectedUnit.bedrooms === 0 ? 'Studio' : selectedUnit.bedrooms}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Bathrooms</span>
                    <p className="font-medium">{selectedUnit.bathrooms}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Monthly Rent</span>
                    <p className="font-bold text-lg text-primary-600">
                      KES {selectedUnit.rent.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tenant Card */}
              {selectedUnit.tenant && (
                <div className="card p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Tenant Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{selectedUnit.tenant.name}</h4>
                        <p className="text-xs text-gray-500">
                          Since {selectedUnit.tenant.moveInDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <a
                        href={`tel:${selectedUnit.tenant.phone}`}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600"
                      >
                        <Phone className="w-4 h-4" />
                        {selectedUnit.tenant.phone}
                      </a>
                      <a
                        href={`mailto:${selectedUnit.tenant.email}`}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600"
                      >
                        <Mail className="w-4 h-4" />
                        {selectedUnit.tenant.email}
                      </a>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Lease Period
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {selectedUnit.tenant.leaseStart.toLocaleDateString()} -{' '}
                        {selectedUnit.tenant.leaseEnd.toLocaleDateString()}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          Payment Status
                        </span>
                        {selectedUnit.tenant.rentPaid ? (
                          <span className="badge bg-emerald-100 text-emerald-700 text-xs">
                            Paid
                          </span>
                        ) : (
                          <span className="badge bg-red-100 text-red-700 text-xs">
                            KES {selectedUnit.tenant.balance.toLocaleString()} Due
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vacant Unit Info */}
              {selectedUnit.status === 'vacant' && selectedUnit.availableFrom && (
                <div className="card bg-blue-50 p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Available Now</h3>
                  <p className="text-sm text-blue-700">
                    This unit is ready for immediate move-in. Schedule a showing or start tenant onboarding.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button 
                      className="btn-primary text-sm flex-1"
                      onClick={() => {
                        setSelectedUnit(null);
                        setOnboardingUnit(selectedUnit);
                        setShowOnboardingModal(true);
                      }}
                    >
                      Start Onboarding
                    </button>
                    <button className="btn-secondary text-sm flex-1">Schedule Showing</button>
                  </div>
                </div>
              )}

              {/* Notice Unit - Process Move-Out */}
              {selectedUnit.status === 'notice' && (
                <div className="card bg-amber-50 p-4">
                  <h3 className="font-medium text-amber-900 mb-2">Notice Period</h3>
                  <p className="text-sm text-amber-700 mb-3">
                    Tenant has given notice. Lease ends on {selectedUnit.tenant?.leaseEnd.toLocaleDateString()}.
                  </p>
                  <div className="flex gap-2">
                    <button 
                      className="btn-primary text-sm flex-1"
                      onClick={() => {
                        setSelectedUnit(null);
                        setMoveOutUnit(selectedUnit);
                        setShowMoveOutModal(true);
                      }}
                    >
                      Process Move-Out
                    </button>
                    <button className="btn-secondary text-sm flex-1">Schedule Inspection</button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button className="btn-secondary flex-1">View History</button>
                <button className="btn-primary flex-1">Edit Unit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {showOnboardingModal && onboardingUnit && (
        <OnboardingModal
          unit={onboardingUnit}
          onClose={() => {
            setShowOnboardingModal(false);
            setOnboardingUnit(null);
          }}
        />
      )}

      {/* Move-Out Modal */}
      {showMoveOutModal && moveOutUnit && (
        <MoveOutModal
          unit={moveOutUnit}
          onClose={() => {
            setShowMoveOutModal(false);
            setMoveOutUnit(null);
          }}
        />
      )}
    </>
  );
}

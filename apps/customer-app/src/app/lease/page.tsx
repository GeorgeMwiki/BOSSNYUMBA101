'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  AlertTriangle,
  Clock,
  Phone,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

// Default lease data (used as fallback)
const DEFAULT_LEASE = {
  leaseNumber: 'LSE-2023-0124',
  status: 'active',
  type: 'Fixed Term',
  startDate: '2023-06-01',
  endDate: '2024-05-31',
  daysRemaining: 75,
  property: {
    name: 'Sunset Apartments',
    address: '123 Kenyatta Avenue, Nairobi',
    imageUrl: '/api/placeholder/400/240',
  },
  unit: {
    number: 'A-204',
    type: '2 Bedroom',
    floor: '2nd Floor',
  },
  rent: {
    amount: 40000,
    frequency: 'Monthly',
    dueDay: 1,
  },
  deposit: {
    amount: 80000,
    paid: true,
  },
  terms: [
    'Fixed-term lease, 12 months',
    'Rent due on the 1st of each month',
    '30-day notice required for early termination',
    'Pets allowed with prior approval',
  ],
  occupants: [
    { name: 'John Kamau', relationship: 'Primary Tenant' },
    { name: 'Mary Kamau', relationship: 'Spouse' },
  ],
  propertyManager: {
    name: 'Jane Mwangi',
    phone: '+254 700 123 456',
    email: 'jane@sunsetapartments.co.ke',
  },
};

const documents = [
  { id: '1', name: 'Lease Agreement', date: '2023-05-28', type: 'pdf' },
  { id: '2', name: 'Move-in Inspection Report', date: '2023-06-01', type: 'pdf' },
  { id: '3', name: 'House Rules', date: '2023-05-28', type: 'pdf' },
];

export default function LeasePage() {
  const [lease, setLease] = useState(DEFAULT_LEASE);

  useEffect(() => {
    api.lease.getCurrent().then((data: any) => {
      if (data && data.leaseNumber) {
        setLease(data);
      }
    }).catch(() => {
      // Use default
    });
  }, []);

  const isExpiringSoon = lease.daysRemaining <= 60;

  const handleDownloadLease = () => {
    // In production, would fetch and trigger download
    window.open(`/lease/documents/${documents[0].id}`, '_blank');
  };

  return (
    <>
      <PageHeader title="My Lease" showSettings />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Expiry Warning */}
        {isExpiringSoon && (
          <div className="card p-4 bg-warning-50 border-warning-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-warning-900">Lease Expiring Soon</h3>
                <p className="text-sm text-warning-700 mt-1">
                  Your lease expires in {lease.daysRemaining} days. Contact management about renewal options.
                </p>
                <Link href="/lease/renewal" className="btn-primary mt-3 text-sm inline-flex">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  View Renewal Offer
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Property/Unit Info with Photo */}
        <section className="card overflow-hidden p-0">
          <div className="aspect-[5/3] bg-gray-200 relative">
            <img
              src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=240&fit=crop"
              alt={lease.property.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <h2 className="text-lg font-semibold text-white">{lease.property.name}</h2>
              <p className="text-sm text-white/90">{lease.unit.number} · {lease.unit.type}</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-500">{lease.property.address}</p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-gray-600">Unit {lease.unit.number}</span>
              <span className="text-gray-600">{lease.unit.floor}</span>
            </div>
          </div>
        </section>

        {/* Lease Dates & Rent */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-400">{lease.leaseNumber}</div>
              <h3 className="font-medium">Lease Details</h3>
            </div>
            <span className="badge-success">Active</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500">Start Date</div>
              <div className="font-medium">
                {new Date(lease.startDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">End Date</div>
              <div className="font-medium">
                {new Date(lease.endDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Lease Type</div>
              <div className="font-medium">{lease.type}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Time Remaining</div>
              <div className="font-medium flex items-center gap-1">
                <Clock className="w-4 h-4 text-warning-500" />
                {lease.daysRemaining} days
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Monthly Rent</span>
              <span className="text-xl font-semibold text-primary-600">
                KES {lease.rent.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-500">Due on the {lease.rent.dueDay}st each month</span>
            </div>
          </div>
        </section>

        {/* Deposit */}
        <section className="card p-4">
          <h3 className="font-medium mb-3">Deposit Information</h3>
          <div className="flex justify-between">
            <span className="text-gray-600">Security Deposit</span>
            <span className="font-medium">
              KES {lease.deposit.amount.toLocaleString()}
              <span className="text-success-600 text-sm ml-1">(Paid)</span>
            </span>
          </div>
        </section>

        {/* Lease Terms Summary */}
        <section className="card p-4">
          <h3 className="font-medium mb-3">Lease Terms Summary</h3>
          <ul className="space-y-2">
            {lease.terms.map((term, index) => (
              <li key={index} className="flex gap-2 text-sm text-gray-600">
                <span className="text-primary-500 mt-0.5">•</span>
                {term}
              </li>
            ))}
          </ul>
        </section>

        {/* Download Lease & Contact Manager */}
        <section className="space-y-3">
          <button
            onClick={handleDownloadLease}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download lease document
          </button>

          <a
            href={`tel:${lease.propertyManager.phone.replace(/\s/g, '')}`}
            className="w-full card p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Phone className="w-5 h-5 text-primary-600" />
              </div>
              <div className="text-left">
                <div className="font-medium">Contact property manager</div>
                <div className="text-sm text-gray-500">{lease.propertyManager.name}</div>
                <div className="text-sm text-primary-600">{lease.propertyManager.phone}</div>
              </div>
            </div>
            <Phone className="w-5 h-5 text-primary-600" />
          </a>
        </section>

        {/* Documents */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500">Documents</h3>
            <Link
              href="/lease/documents"
              className="text-sm text-primary-600 font-medium"
            >
              View all
            </Link>
          </div>
          <div className="card divide-y divide-gray-100">
            {documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/lease/documents/${doc.id}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50"
              >
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{doc.name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(doc.date).toLocaleDateString()}
                  </div>
                </div>
                <Download className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </section>

        {/* Lease Actions */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Lease Actions</h3>
          <div className="space-y-3">
            <Link
              href="/lease/renewal"
              className="card p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <RefreshCw className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Lease Renewal</div>
                <div className="text-xs text-gray-500">
                  View renewal options and offers
                </div>
              </div>
            </Link>

            <Link
              href="/lease/move-out"
              className="card p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-warning-50 rounded-lg">
                <LogOut className="w-5 h-5 text-warning-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Move-Out Notice</div>
                <div className="text-xs text-gray-500">
                  Submit notice and start move-out process
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

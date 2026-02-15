'use client';

import Link from 'next/link';
import { Phone, AlertTriangle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const emergencyContacts = [
  {
    name: 'Property Manager',
    phone: '+254 700 123 456',
    available: '24/7',
    type: 'primary',
  },
  {
    name: 'Maintenance Emergency',
    phone: '+254 700 789 012',
    available: '8am–6pm',
    type: 'maintenance',
  },
  {
    name: 'Security',
    phone: '+254 700 345 678',
    available: '24/7',
    type: 'security',
  },
  {
    name: 'National Emergency',
    phone: '999',
    available: '24/7',
    type: 'police',
  },
  {
    name: 'Fire & Ambulance',
    phone: '999',
    available: '24/7',
    type: 'fire',
  },
];

export default function EmergenciesPage() {
  return (
    <>
      <PageHeader
        title="Emergency Contacts"
        action={
          <Link href="/emergencies/report" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Report
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6">
        <div className="card p-4 bg-danger-50 border-danger-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-danger-900">
                Life-threatening emergency?
              </h3>
              <p className="text-sm text-danger-700 mt-1">
                Call <strong>999</strong> immediately for police, fire, or
                ambulance.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/emergencies/report"
          className="card p-4 flex items-center justify-between bg-primary-50 border-primary-100 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">Report an emergency</div>
              <div className="text-sm text-gray-600">
                Water leak, power outage, security issue
              </div>
            </div>
          </div>
        </Link>

        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Emergency Numbers
          </h3>
          <div className="card divide-y divide-gray-100">
            {emergencyContacts.map((contact, index) => (
              <a
                key={index}
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <Phone className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-medium">{contact.name}</div>
                    <div className="text-sm text-primary-600 font-medium">
                      {contact.phone}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Available: {contact.available}
                    </div>
                  </div>
                </div>
                <Phone className="w-5 h-5 text-primary-600 flex-shrink-0" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  Clock,
  Home,
  Shield,
  AlertTriangle,
  Volume2,
  Car,
  Users,
  Trash2,
  Dog,
  Cigarette,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface Document {
  id: string;
  name: string;
  category: 'lease' | 'payment' | 'inspection' | 'other';
  date: string;
  type: 'pdf';
  size?: string;
  status?: 'active' | 'expired' | 'pending';
}

interface HouseRule {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  items: string[];
}

const documents: Document[] = [
  {
    id: '1',
    name: 'Lease Agreement',
    category: 'lease',
    date: '2023-05-28',
    type: 'pdf',
    size: '2.4 MB',
    status: 'active',
  },
  {
    id: '2',
    name: 'Move-in Inspection Report',
    category: 'inspection',
    date: '2023-06-01',
    type: 'pdf',
    size: '4.1 MB',
  },
  {
    id: '3',
    name: 'February 2024 Statement',
    category: 'payment',
    date: '2024-02-01',
    type: 'pdf',
    size: '156 KB',
  },
  {
    id: '4',
    name: 'January 2024 Statement',
    category: 'payment',
    date: '2024-01-01',
    type: 'pdf',
    size: '148 KB',
  },
  {
    id: '5',
    name: 'House Rules',
    category: 'lease',
    date: '2023-05-28',
    type: 'pdf',
    size: '890 KB',
  },
];

const HOUSE_RULES: HouseRule[] = [
  {
    id: 'quiet',
    title: 'Quiet Hours',
    icon: Volume2,
    color: 'bg-purple-50 text-purple-600',
    items: [
      'Quiet hours are observed from 10:00 PM to 7:00 AM daily',
      'Keep noise levels reasonable during all hours',
      'Use headphones for music/TV after 10:00 PM',
      'Notify neighbors in advance of any gatherings',
    ],
  },
  {
    id: 'common',
    title: 'Common Areas',
    icon: Users,
    color: 'bg-blue-50 text-blue-600',
    items: [
      'Gym hours: 5:00 AM to 11:00 PM',
      'Pool hours: 7:00 AM to 10:00 PM',
      'Guests must be accompanied in all common areas',
      'Clean up after yourself in shared spaces',
      'Report any damage or issues immediately',
    ],
  },
  {
    id: 'parking',
    title: 'Parking',
    icon: Car,
    color: 'bg-green-50 text-green-600',
    items: [
      'Each unit is assigned one parking space',
      'Guest parking available in designated areas only',
      'No vehicle repairs in parking areas',
      'Keep your parking space clean',
      'Unauthorized vehicles may be towed',
    ],
  },
  {
    id: 'waste',
    title: 'Waste Disposal',
    icon: Trash2,
    color: 'bg-amber-50 text-amber-600',
    items: [
      'Use designated bins for recycling and general waste',
      'Large items require special pickup - contact management',
      'No dumping in common areas',
      'Garbage chute hours: 7:00 AM to 10:00 PM',
    ],
  },
  {
    id: 'pets',
    title: 'Pet Policy',
    icon: Dog,
    color: 'bg-pink-50 text-pink-600',
    items: [
      'Pets must be registered with management',
      'Maximum 2 pets per unit',
      'Dogs must be leashed in common areas',
      'Clean up after your pets immediately',
      'Aggressive breeds may require additional approval',
    ],
  },
  {
    id: 'smoking',
    title: 'Smoking Policy',
    icon: Cigarette,
    color: 'bg-red-50 text-red-600',
    items: [
      'Smoking is prohibited inside all buildings',
      'Designated smoking areas are available outside',
      'Keep 25 feet from building entrances',
      'Dispose of cigarette butts properly',
    ],
  },
];

const categoryConfig = {
  lease: { label: 'Lease', color: 'bg-primary-50 text-primary-600' },
  payment: { label: 'Payment', color: 'bg-green-50 text-green-600' },
  inspection: { label: 'Inspection', color: 'bg-purple-50 text-purple-600' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-600' },
};

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<'documents' | 'rules'>('documents');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const leaseDocuments = documents.filter((d) => d.category === 'lease' || d.category === 'inspection');
  const paymentDocuments = documents.filter((d) => d.category === 'payment');

  const toggleRule = (ruleId: string) => {
    setExpandedRule(expandedRule === ruleId ? null : ruleId);
  };

  return (
    <>
      <PageHeader title="Documents" showBack />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'documents'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            My Documents
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'rules'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            House Rules
          </button>
        </div>

        {activeTab === 'documents' && (
          <>
            {/* Lease Summary Card */}
            <div className="card overflow-hidden">
              <div className="p-4 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Active Lease</h3>
                    <p className="text-sm opacity-90">Unit A-204 • Sunset Apartments</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="opacity-75 mb-0.5">Start Date</div>
                    <div className="font-medium">June 1, 2023</div>
                  </div>
                  <div>
                    <div className="opacity-75 mb-0.5">End Date</div>
                    <div className="font-medium">May 31, 2024</div>
                  </div>
                  <div>
                    <div className="opacity-75 mb-0.5">Monthly Rent</div>
                    <div className="font-medium">KES 40,000</div>
                  </div>
                  <div>
                    <div className="opacity-75 mb-0.5">Status</div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex border-t border-gray-100">
                <Link
                  href="/lease"
                  className="flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium text-primary-600 hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Lease
                </Link>
                <div className="w-px bg-gray-100" />
                <Link
                  href="/lease/renewal"
                  className="flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium text-primary-600 hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Renewal Info
                </Link>
              </div>
            </div>

            {/* Lease Documents */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Lease Documents</h2>
              <div className="card divide-y divide-gray-100">
                {leaseDocuments.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} onSelect={setSelectedDocument} />
                ))}
              </div>
            </section>

            {/* Payment Statements */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Payment Statements</h2>
              <div className="card divide-y divide-gray-100">
                {paymentDocuments.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} onSelect={setSelectedDocument} />
                ))}
              </div>
              <Link
                href="/payments/history"
                className="block text-center text-sm text-primary-600 py-4"
              >
                View All Statements →
              </Link>
            </section>
          </>
        )}

        {activeTab === 'rules' && (
          <>
            {/* Important Notice */}
            <div className="card p-4 bg-warning-50 border-warning-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-warning-900 mb-1">Important</h3>
                  <p className="text-sm text-warning-800">
                    Violation of house rules may result in warnings, fines, or lease termination.
                    Please review all rules carefully.
                  </p>
                </div>
              </div>
            </div>

            {/* Rules Accordion */}
            <div className="space-y-3">
              {HOUSE_RULES.map((rule) => {
                const Icon = rule.icon;
                const isExpanded = expandedRule === rule.id;

                return (
                  <div key={rule.id} className="card overflow-hidden">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className="w-full p-4 flex items-center gap-3 text-left"
                    >
                      <div className={`p-2 rounded-lg ${rule.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="flex-1 font-medium">{rule.title}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-gray-100 pt-4">
                          <ul className="space-y-3">
                            {rule.items.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-sm text-gray-600">
                                <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Download Full Rules */}
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Complete House Rules</h3>
                    <p className="text-sm text-gray-500">PDF • 890 KB</p>
                  </div>
                </div>
                <button className="btn-secondary text-sm">
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-4 animate-slide-up safe-area-bottom">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedDocument.name}</h3>
              <button
                onClick={() => setSelectedDocument(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="card p-4 flex items-center gap-4">
              <div className="p-3 bg-gray-100 rounded-xl">
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{selectedDocument.name}</h4>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <span>{categoryConfig[selectedDocument.category].label}</span>
                  <span>•</span>
                  <span>{selectedDocument.size}</span>
                  <span>•</span>
                  <span>{new Date(selectedDocument.date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/documents/${selectedDocument.id}`}
                className="btn-secondary flex-1 py-4"
                onClick={() => setSelectedDocument(null)}
              >
                <Eye className="w-5 h-5 mr-2" />
                View
              </Link>
              <button className="btn-primary flex-1 py-4">
                <Download className="w-5 h-5 mr-2" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

function DocumentRow({
  document,
  onSelect,
}: {
  document: Document;
  onSelect: (doc: Document) => void;
}) {
  const category = categoryConfig[document.category];

  return (
    <button
      onClick={() => onSelect(document)}
      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="p-2 bg-gray-100 rounded-lg">
        <FileText className="w-5 h-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{document.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full ${category.color}`}>
            {category.label}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(document.date).toLocaleDateString()}
          </span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}

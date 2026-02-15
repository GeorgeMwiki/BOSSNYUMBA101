import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderOpen,
  Edit3,
  History,
  Upload,
  X,
  ChevronRight,
  Building2,
  User,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { api, formatDate, formatDateTime } from '../lib/api';

interface DocumentVersion {
  id: string;
  versionNumber: number;
  uploadedAt: string;
  uploadedBy: string;
  changeNote?: string;
  size: number;
}

interface Document {
  id: string;
  type: string;
  category: string;
  name: string;
  mimeType: string;
  size: number;
  verificationStatus: string;
  verifiedAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string };
  customer?: { id: string; name: string };
  requiresSignature?: boolean;
  signatureStatus?: 'PENDING' | 'SIGNED' | 'EXPIRED';
  signedAt?: string;
  signedBy?: string;
  versions?: DocumentVersion[];
}

interface DocumentCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);

  const categories: DocumentCategory[] = [
    { id: 'leases', name: 'Leases & Agreements', icon: '📄', count: 0, description: 'Rental agreements, addendums' },
    { id: 'financial', name: 'Financial Documents', icon: '💰', count: 0, description: 'Statements, receipts, invoices' },
    { id: 'compliance', name: 'Compliance & Legal', icon: '⚖️', count: 0, description: 'Licenses, permits, legal notices' },
    { id: 'reports', name: 'Reports', icon: '📊', count: 0, description: 'Inspection, maintenance reports' },
    { id: 'identity', name: 'Identity Documents', icon: '🪪', count: 0, description: 'ID copies, verification docs' },
    { id: 'other', name: 'Other', icon: '📁', count: 0, description: 'Miscellaneous documents' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Mock data for development
    setDocuments([
      {
        id: '1', type: 'LEASE', category: 'leases', name: 'Lease Agreement - Unit A-102.pdf', mimeType: 'application/pdf', size: 2458000,
        verificationStatus: 'VERIFIED', verifiedAt: '2026-01-15T10:30:00Z', tags: ['active', 'residential'],
        createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-15T10:30:00Z',
        property: { id: '1', name: 'Palm Gardens' }, unit: { id: '1', unitNumber: 'A-102' }, customer: { id: '1', name: 'John Doe' },
        requiresSignature: true, signatureStatus: 'SIGNED', signedAt: '2026-01-12T14:20:00Z', signedBy: 'John Doe',
        versions: [
          { id: 'v3', versionNumber: 3, uploadedAt: '2026-01-10T08:00:00Z', uploadedBy: 'System', changeNote: 'Final signed version', size: 2458000 },
          { id: 'v2', versionNumber: 2, uploadedAt: '2026-01-08T15:30:00Z', uploadedBy: 'Estate Manager', changeNote: 'Updated rent amount', size: 2445000 },
          { id: 'v1', versionNumber: 1, uploadedAt: '2026-01-05T09:00:00Z', uploadedBy: 'Estate Manager', changeNote: 'Initial draft', size: 2420000 },
        ]
      },
      {
        id: '2', type: 'INVOICE', category: 'financial', name: 'Invoice_Feb2026_A102.pdf', mimeType: 'application/pdf', size: 156000,
        verificationStatus: 'VERIFIED', tags: ['february', '2026'], createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
        property: { id: '1', name: 'Palm Gardens' }, unit: { id: '1', unitNumber: 'A-102' },
      },
      {
        id: '3', type: 'INSPECTION_REPORT', category: 'reports', name: 'Move-In Inspection Report - B-301.pdf', mimeType: 'application/pdf', size: 5820000,
        verificationStatus: 'VERIFIED', verifiedAt: '2026-02-05T16:00:00Z', tags: ['inspection', 'move-in'],
        createdAt: '2026-02-05T14:30:00Z', updatedAt: '2026-02-05T16:00:00Z',
        property: { id: '1', name: 'Palm Gardens' }, unit: { id: '2', unitNumber: 'B-301' }, customer: { id: '2', name: 'Jane Smith' },
        requiresSignature: true, signatureStatus: 'PENDING',
        versions: [
          { id: 'v1', versionNumber: 1, uploadedAt: '2026-02-05T14:30:00Z', uploadedBy: 'Estate Manager', size: 5820000 },
        ]
      },
      {
        id: '4', type: 'LICENSE', category: 'compliance', name: 'Business License 2026.pdf', mimeType: 'application/pdf', size: 890000,
        verificationStatus: 'VERIFIED', tags: ['license', '2026', 'compliance'], createdAt: '2026-01-02T09:00:00Z', updatedAt: '2026-01-02T09:00:00Z',
        property: { id: '1', name: 'Palm Gardens' },
      },
      {
        id: '5', type: 'ID_DOCUMENT', category: 'identity', name: 'Tenant ID - Mike Wilson.jpg', mimeType: 'image/jpeg', size: 1240000,
        verificationStatus: 'PENDING', tags: ['id', 'verification'], createdAt: '2026-02-10T11:00:00Z', updatedAt: '2026-02-10T11:00:00Z',
        customer: { id: '3', name: 'Mike Wilson' },
      },
      {
        id: '6', type: 'STATEMENT', category: 'financial', name: 'Owner Statement - January 2026.pdf', mimeType: 'application/pdf', size: 345000,
        verificationStatus: 'VERIFIED', tags: ['statement', 'january', '2026'], createdAt: '2026-02-05T00:00:00Z', updatedAt: '2026-02-05T00:00:00Z',
      },
    ]);
    setLoading(false);
  };

  const getCategoryCount = (categoryId: string) => {
    return documents.filter(doc => doc.category === categoryId).length;
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'REJECTED': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getSignatureStatusColor = (status?: string) => {
    switch (status) {
      case 'SIGNED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-orange-100 text-orange-700';
      case 'EXPIRED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'LEASE': return '📄';
      case 'ID_DOCUMENT': return '🪪';
      case 'INSPECTION_REPORT': return '📋';
      case 'RECEIPT': case 'INVOICE': case 'STATEMENT': return '🧾';
      case 'LICENSE': return '📜';
      case 'PHOTO': return '📷';
      default: return '📁';
    }
  };

  const documentTypes = ['all', ...new Set(documents.map((d) => d.type))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500">View and manage property documents</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Document Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setCategoryFilter(categoryFilter === category.id ? 'all' : category.id)}
            className={`p-4 rounded-xl border text-left transition-all ${
              categoryFilter === category.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">{category.icon}</div>
            <p className="font-medium text-gray-900 text-sm">{category.name}</p>
            <p className="text-xs text-gray-500">{getCategoryCount(category.id)} documents</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents by name or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>{type === 'all' ? 'All Types' : type.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pending E-Signatures Alert */}
      {documents.some(d => d.signatureStatus === 'PENDING') && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit3 className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">Documents awaiting signature</p>
              <p className="text-sm text-orange-600">
                {documents.filter(d => d.signatureStatus === 'PENDING').length} document(s) require your signature
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/documents/e-signature')}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
          >
            Review & Sign
          </button>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property / Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signature</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getTypeIcon(doc.type)}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-xs">{doc.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {doc.property && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {doc.property.name}
                        {doc.unit && ` - ${doc.unit.unitNumber}`}
                      </div>
                    )}
                    {doc.customer && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <User className="h-3 w-3" />
                        {doc.customer.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(doc.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(doc.verificationStatus)}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(doc.verificationStatus)}`}>
                        {doc.verificationStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {doc.requiresSignature ? (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSignatureStatusColor(doc.signatureStatus)}`}>
                        {doc.signatureStatus === 'SIGNED' ? `Signed ${formatDate(doc.signedAt || '')}` : doc.signatureStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Download">
                        <Download className="h-4 w-4" />
                      </button>
                      {doc.versions && doc.versions.length > 1 && (
                        <button
                          onClick={() => { setSelectedDocument(doc); setShowVersionHistory(true); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Version History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      )}
                      {doc.signatureStatus === 'PENDING' && (
                        <button
                          onClick={() => navigate('/documents/e-signature')}
                          className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                          title="Sign Document"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No documents found</p>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && selectedDocument && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowVersionHistory(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
                  <p className="text-sm text-gray-500">{selectedDocument.name}</p>
                </div>
                <button onClick={() => setShowVersionHistory(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {selectedDocument.versions?.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-3 rounded-lg border ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${index === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          v{version.versionNumber}
                        </span>
                        {index === 0 && <span className="text-xs text-blue-600">Current</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{version.changeNote || 'No description'}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{formatDateTime(version.uploadedAt)}</span>
                      <span>by {version.uploadedBy}</span>
                      <span>{formatFileSize(version.size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E-Signature Modal */}
      {showESignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowESignModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">E-Signature</h3>
                  <p className="text-sm text-gray-500">Review and sign documents</p>
                </div>
                <button onClick={() => setShowESignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Edit3 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">E-Signature Integration</p>
                      <p className="text-sm text-blue-600 mt-1">
                        This is a placeholder for e-signature integration. In production, this would connect to
                        a service like DocuSign, HelloSign, or similar e-signature provider.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Documents Awaiting Your Signature</h4>
                  {documents.filter(d => d.signatureStatus === 'PENDING').map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{getTypeIcon(doc.type)}</div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {doc.property?.name} {doc.unit && `- Unit ${doc.unit.unitNumber}`}
                          </p>
                        </div>
                      </div>
                      <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                        <Edit3 className="h-4 w-4" />
                        Sign Now
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-gray-500">
                    By signing these documents electronically, you agree to the terms and conditions outlined in each document.
                    Electronic signatures are legally binding under applicable laws.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

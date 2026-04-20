import React, { useState } from 'react';
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
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatDate, formatDateTime } from '../lib/api';
import { useDocuments, type OwnerDocument as Document } from '../lib/hooks';

interface DocumentCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}

export function DocumentsPage() {
  const t = useTranslations('documentsPageFull');
  const navigate = useNavigate();
  const { data: documents = [], isLoading: loading, error: queryError, refetch } = useDocuments();
  const error = queryError instanceof Error ? queryError.message : null;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);

  const categories: DocumentCategory[] = [
    { id: 'leases', name: t('catLeases'), icon: '📄', count: 0, description: t('catLeasesDesc') },
    { id: 'financial', name: t('catFinancial'), icon: '💰', count: 0, description: t('catFinancialDesc') },
    { id: 'compliance', name: t('catCompliance'), icon: '⚖️', count: 0, description: t('catComplianceDesc') },
    { id: 'reports', name: t('catReports'), icon: '📊', count: 0, description: t('catReportsDesc') },
    { id: 'identity', name: t('catIdentity'), icon: '🪪', count: 0, description: t('catIdentityDesc') },
    { id: 'other', name: t('catOther'), icon: '📁', count: 0, description: t('catOtherDesc') },
  ];

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
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          <Upload className="h-4 w-4" />
          {t('uploadDocument')}
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
            <p className="text-xs text-gray-500">{t('documentsCount', { count: getCategoryCount(category.id) })}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
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
              <option key={type} value={type}>{type === 'all' ? t('allTypes') : type.replace('_', ' ')}</option>
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
              <p className="font-medium text-orange-800">{t('awaitingSignature')}</p>
              <p className="text-sm text-orange-600">
                {t('awaitingSignatureCount', { count: documents.filter(d => d.signatureStatus === 'PENDING').length })}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/documents/e-signature')}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
          >
            {t('reviewAndSign')}
          </button>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDocument')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colPropertyTenant')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDate')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colSignature')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('colActions')}</th>
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
                        {doc.signatureStatus === 'SIGNED' ? t('signedOn', { date: formatDate(doc.signedAt || '') }) : doc.signatureStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{t('na')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title={t('view')}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title={t('download')}>
                        <Download className="h-4 w-4" />
                      </button>
                      {doc.versions && doc.versions.length > 1 && (
                        <button
                          onClick={() => { setSelectedDocument(doc); setShowVersionHistory(true); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title={t('versionHistory')}
                        >
                          <History className="h-4 w-4" />
                        </button>
                      )}
                      {doc.signatureStatus === 'PENDING' && (
                        <button
                          onClick={() => navigate('/documents/e-signature')}
                          className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                          title={t('signDocument')}
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
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title={t('noDocuments')}
          description={
            search || typeFilter !== 'all' || categoryFilter !== 'all'
              ? t('noDocumentsFiltered')
              : t('noDocumentsEmpty')
          }
        />
      )}

      {/* Version History Modal */}
      {showVersionHistory && selectedDocument && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowVersionHistory(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('versionHistory')}</h3>
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
                        {index === 0 && <span className="text-xs text-blue-600">{t('current')}</span>}
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
                    <p className="text-sm text-gray-600 mt-2">{version.changeNote || t('noDescription')}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{formatDateTime(version.uploadedAt)}</span>
                      <span>{t('byPrefix', { user: version.uploadedBy })}</span>
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
                  <h3 className="text-lg font-semibold text-gray-900">{t('eSignature')}</h3>
                  <p className="text-sm text-gray-500">{t('reviewAndSignDocs')}</p>
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
                      <p className="font-medium text-blue-800">{t('eSignIntegrationTitle')}</p>
                      <p className="text-sm text-blue-600 mt-1">
                        {t('eSignIntegrationDesc')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">{t('awaitingSignatureTitle')}</h4>
                  {documents.filter(d => d.signatureStatus === 'PENDING').map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{getTypeIcon(doc.type)}</div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {doc.property?.name} {doc.unit && t('dashUnitPrefix', { unit: doc.unit.unitNumber })}
                          </p>
                        </div>
                      </div>
                      <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                        <Edit3 className="h-4 w-4" />
                        {t('signNow')}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-gray-500">
                    {t('eSignLegalDisclaimer')}
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

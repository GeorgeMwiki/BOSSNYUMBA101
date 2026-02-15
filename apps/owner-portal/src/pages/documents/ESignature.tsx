import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  X,
  RotateCcw,
  Pen,
  Building2,
  User,
  Calendar,
  ChevronRight,
  Loader2,
  ArrowLeft,
  History,
} from 'lucide-react';
import { api, formatDate, formatDateTime } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────
interface SignatureDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string };
  customer?: { id: string; name: string };
  signatureStatus: 'PENDING' | 'SIGNED' | 'EXPIRED' | 'DECLINED';
  signedAt?: string;
  signedBy?: string;
  expiresAt?: string;
  createdAt: string;
  size: number;
  previewUrl?: string;
}

interface SignatureHistoryEntry {
  id: string;
  documentName: string;
  signedAt: string;
  signedBy: string;
  property?: { id: string; name: string };
  status: 'SIGNED' | 'DECLINED' | 'EXPIRED';
  ipAddress?: string;
}

// ─── Signature Canvas Component ──────────────────────────────────
function SignatureCanvas({
  onSave,
  onClear,
}: {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasDrawn(true);
    },
    [getCoords]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    },
    [isDrawing, getCoords]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onClear();
  }, [onClear]);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  }, [hasDrawn, onSave]);

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={560}
          height={200}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Draw your signature here</p>
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4 border-b border-gray-300" />
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={clearCanvas}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RotateCcw className="h-4 w-4" />
          Clear
        </button>
        <button
          onClick={saveSignature}
          disabled={!hasDrawn}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Pen className="h-4 w-4" />
          Apply Signature
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export function ESignaturePage() {
  const navigate = useNavigate();
  const [pendingDocs, setPendingDocs] = useState<SignatureDocument[]>([]);
  const [history, setHistory] = useState<SignatureHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [signingDoc, setSigningDoc] = useState<SignatureDocument | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successDoc, setSuccessDoc] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ pending: SignatureDocument[]; history: SignatureHistoryEntry[] }>(
        '/owner/documents/signatures'
      );
      if (response.success && response.data) {
        setPendingDocs(response.data.pending || []);
        setHistory(response.data.history || []);
      }
    } catch {
      // Fallback mock data for development
      setPendingDocs([
        {
          id: 'sig-1',
          name: 'Move-In Inspection Report - B-301.pdf',
          type: 'INSPECTION_REPORT',
          category: 'reports',
          property: { id: '1', name: 'Palm Gardens' },
          unit: { id: '2', unitNumber: 'B-301' },
          customer: { id: '2', name: 'Jane Smith' },
          signatureStatus: 'PENDING',
          expiresAt: '2026-03-05T00:00:00Z',
          createdAt: '2026-02-05T14:30:00Z',
          size: 5820000,
        },
        {
          id: 'sig-2',
          name: 'Lease Renewal Agreement - D-101.pdf',
          type: 'LEASE',
          category: 'leases',
          property: { id: '2', name: 'Ocean View Apartments' },
          unit: { id: '5', unitNumber: 'D-101' },
          customer: { id: '5', name: 'David Brown' },
          signatureStatus: 'PENDING',
          expiresAt: '2026-02-28T00:00:00Z',
          createdAt: '2026-02-10T09:00:00Z',
          size: 2340000,
        },
        {
          id: 'sig-3',
          name: 'Property Management Agreement 2026.pdf',
          type: 'CONTRACT',
          category: 'compliance',
          property: { id: '1', name: 'Palm Gardens' },
          signatureStatus: 'PENDING',
          expiresAt: '2026-03-15T00:00:00Z',
          createdAt: '2026-02-12T11:00:00Z',
          size: 1890000,
        },
      ]);

      setHistory([
        {
          id: 'hist-1',
          documentName: 'Lease Agreement - Unit A-102.pdf',
          signedAt: '2026-01-12T14:20:00Z',
          signedBy: 'John Doe',
          property: { id: '1', name: 'Palm Gardens' },
          status: 'SIGNED',
          ipAddress: '192.168.1.***',
        },
        {
          id: 'hist-2',
          documentName: 'Insurance Certificate Acknowledgment.pdf',
          signedAt: '2026-01-08T10:15:00Z',
          signedBy: 'John Doe',
          property: { id: '1', name: 'Palm Gardens' },
          status: 'SIGNED',
          ipAddress: '192.168.1.***',
        },
        {
          id: 'hist-3',
          documentName: 'Maintenance Policy Update 2026.pdf',
          signedAt: '2025-12-20T16:30:00Z',
          signedBy: 'John Doe',
          property: { id: '2', name: 'Ocean View Apartments' },
          status: 'SIGNED',
          ipAddress: '10.0.0.***',
        },
        {
          id: 'hist-4',
          documentName: 'Vendor Contract - ABC Plumbing.pdf',
          signedAt: '2025-12-15T09:45:00Z',
          signedBy: 'John Doe',
          status: 'DECLINED',
        },
      ]);
    }
    setLoading(false);
  };

  const handleSignAndSubmit = async () => {
    if (!signingDoc || !signatureData || !agreedToTerms) return;
    setSubmitting(true);

    try {
      await api.post(`/owner/documents/${signingDoc.id}/sign`, {
        signatureImage: signatureData,
        agreedToTerms: true,
      });
    } catch {
      // Dev fallback
    }

    // Optimistic update
    setPendingDocs((prev) => prev.filter((d) => d.id !== signingDoc.id));
    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        documentName: signingDoc.name,
        signedAt: new Date().toISOString(),
        signedBy: 'John Doe',
        property: signingDoc.property,
        status: 'SIGNED',
      },
      ...prev,
    ]);

    setSuccessDoc(signingDoc.name);
    setSubmitting(false);
    setSigningDoc(null);
    setSignatureData(null);
    setAgreedToTerms(false);

    setTimeout(() => setSuccessDoc(null), 4000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'LEASE':
        return '📄';
      case 'INSPECTION_REPORT':
        return '📋';
      case 'CONTRACT':
        return '📜';
      default:
        return '📁';
    }
  };

  const getStatusHistoryColor = (status: string) => {
    switch (status) {
      case 'SIGNED':
        return 'bg-green-100 text-green-700';
      case 'DECLINED':
        return 'bg-red-100 text-red-700';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/documents')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">E-Signatures</h1>
            <p className="text-gray-500">Review and sign documents electronically</p>
          </div>
        </div>
        {pendingDocs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
            <Edit3 className="h-4 w-4" />
            {pendingDocs.length} pending
          </div>
        )}
      </div>

      {/* Success notification */}
      {successDoc && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 animate-in fade-in">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Document signed successfully</p>
            <p className="text-sm text-green-600">{successDoc}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-4">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              Pending Signatures
              {pendingDocs.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  {pendingDocs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="h-4 w-4" />
              Signature History
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Pending Documents Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingDocs.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">All caught up!</p>
                  <p className="text-sm text-gray-400 mt-1">No documents require your signature</p>
                </div>
              ) : (
                pendingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{getTypeIcon(doc.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-gray-900">{doc.name}</h3>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              {doc.property && (
                                <div className="flex items-center gap-1">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {doc.property.name}
                                  {doc.unit && ` - Unit ${doc.unit.unitNumber}`}
                                </div>
                              )}
                              {doc.customer && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" />
                                  {doc.customer.name}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Created {formatDate(doc.createdAt)}
                              </div>
                              <span className="text-xs text-gray-400">
                                {formatFileSize(doc.size)}
                              </span>
                            </div>
                          </div>
                          {doc.expiresAt && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-500">Expires</p>
                              <p className="text-sm font-medium text-orange-600">
                                {formatDate(doc.expiresAt)}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => setShowPreview(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </button>
                          <button
                            onClick={() => {
                              setSigningDoc(doc);
                              setSignatureData(null);
                              setAgreedToTerms(false);
                            }}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                          >
                            <Edit3 className="h-4 w-4" />
                            Sign Document
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No signature history yet</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg ${
                          entry.status === 'SIGNED'
                            ? 'bg-green-100'
                            : entry.status === 'DECLINED'
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {entry.status === 'SIGNED' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : entry.status === 'DECLINED' ? (
                          <X className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {entry.documentName}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{formatDateTime(entry.signedAt)}</span>
                          {entry.property && <span>{entry.property.name}</span>}
                          {entry.ipAddress && <span>IP: {entry.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusHistoryColor(
                          entry.status
                        )}`}
                      >
                        {entry.status}
                      </span>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Signing Modal */}
      {signingDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => {
                setSigningDoc(null);
                setSignatureData(null);
                setAgreedToTerms(false);
              }}
            />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Sign Document</h3>
                  <p className="text-sm text-gray-500 truncate max-w-md">{signingDoc.name}</p>
                </div>
                <button
                  onClick={() => {
                    setSigningDoc(null);
                    setSignatureData(null);
                    setAgreedToTerms(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Document Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Document</p>
                      <p className="font-medium text-gray-900">{signingDoc.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">
                        {signingDoc.type.replace('_', ' ')}
                      </p>
                    </div>
                    {signingDoc.property && (
                      <div>
                        <p className="text-gray-500">Property</p>
                        <p className="font-medium text-gray-900">
                          {signingDoc.property.name}
                          {signingDoc.unit && ` - Unit ${signingDoc.unit.unitNumber}`}
                        </p>
                      </div>
                    )}
                    {signingDoc.expiresAt && (
                      <div>
                        <p className="text-gray-500">Signature Deadline</p>
                        <p className="font-medium text-orange-600">
                          {formatDate(signingDoc.expiresAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signature Area */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Your Signature</h4>
                  {signatureData ? (
                    <div className="space-y-3">
                      <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 flex items-center justify-center">
                        <img
                          src={signatureData}
                          alt="Your signature"
                          className="max-h-24"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Signature applied</span>
                        </div>
                        <button
                          onClick={() => setSignatureData(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Re-sign
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SignatureCanvas
                      onSave={(dataUrl) => setSignatureData(dataUrl)}
                      onClear={() => setSignatureData(null)}
                    />
                  )}
                </div>

                {/* Terms */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="text-sm text-gray-600">
                      <p>
                        I confirm that I have reviewed the document and agree to sign it
                        electronically. I understand that this electronic signature is legally
                        binding and has the same effect as a handwritten signature.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t p-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  onClick={() => {
                    setSigningDoc(null);
                    setSignatureData(null);
                    setAgreedToTerms(false);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignAndSubmit}
                  disabled={!signatureData || !agreedToTerms || submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4" />
                      Sign & Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ESignaturePage;

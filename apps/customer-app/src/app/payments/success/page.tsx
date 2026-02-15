'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Download,
  Share2,
  Home,
  FileText,
  Receipt,
  Clock,
  Building2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const ref = searchParams.get('ref') || `BN-${Date.now().toString(36).toUpperCase()}`;
  const amount = searchParams.get('amount') ? parseInt(searchParams.get('amount')!, 10) : 45000;
  const method = searchParams.get('method') || 'M-Pesa';
  
  const [showConfetti, setShowConfetti] = useState(true);

  // Trigger confetti on mount
  useEffect(() => {
    if (showConfetti && typeof window !== 'undefined') {
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#0ea5e9', '#f59e0b'],
        });
        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#0ea5e9', '#f59e0b'],
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [showConfetti]);

  const receiptData = {
    reference: ref,
    amount,
    method,
    date: new Date().toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    property: 'Sunset Apartments',
    unit: 'Unit A-204',
    paymentType: 'Monthly Rent - March 2024',
  };

  const handleDownloadReceipt = () => {
    // In production, would generate PDF
    const receiptText = `
BOSSNYUMBA PAYMENT RECEIPT
================================
Reference: ${receiptData.reference}
Date: ${receiptData.date}
Amount: KES ${receiptData.amount.toLocaleString()}
Payment Method: ${receiptData.method}
Property: ${receiptData.property}
Unit: ${receiptData.unit}
Description: ${receiptData.paymentType}
================================
Thank you for your payment!
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${ref}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Receipt',
          text: `Payment of KES ${amount.toLocaleString()} completed successfully. Reference: ${ref}`,
        });
      } catch {
        // User cancelled sharing
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <header className="bg-gradient-to-br from-success-500 to-success-600 text-white px-4 pt-12 pb-16 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-md mx-auto">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-success-100">Your payment has been processed</p>
        </div>
        
        {/* Decorative circles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-20 -right-10 w-60 h-60 bg-white/10 rounded-full" />
      </header>

      {/* Content */}
      <div className="px-4 -mt-8 pb-8 max-w-md mx-auto space-y-6">
        {/* Amount Card */}
        <div className="card p-6 text-center shadow-lg">
          <div className="text-sm text-gray-500 mb-1">Amount Paid</div>
          <div className="text-4xl font-bold text-gray-900">
            KES {amount.toLocaleString()}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-success-600">
            <CheckCircle className="w-4 h-4" />
            Confirmed
          </div>
        </div>

        {/* Receipt Details */}
        <div className="card divide-y divide-gray-100">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Reference</span>
            </div>
            <span className="font-mono font-medium">{receiptData.reference}</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Date & Time</span>
            </div>
            <span className="text-sm">{receiptData.date}</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Payment For</span>
            </div>
            <span className="text-sm">{receiptData.paymentType}</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Property</span>
            </div>
            <div className="text-right text-sm">
              <div>{receiptData.property}</div>
              <div className="text-gray-400">{receiptData.unit}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownloadReceipt}
            className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download
          </button>
          <button
            onClick={handleShare}
            className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" />
            Share
          </button>
        </div>

        {/* Balance Update */}
        <div className="card p-4 bg-success-50 border-success-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success-600" />
            <div>
              <div className="font-medium text-success-900">Balance Updated</div>
              <div className="text-sm text-success-700">
                Your account balance has been updated to reflect this payment.
              </div>
            </div>
          </div>
        </div>

        {/* Go to Dashboard */}
        <Link
          href="/"
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Go to Dashboard
        </Link>

        <Link
          href="/payments/history"
          className="block text-center text-sm text-primary-600 py-2"
        >
          View Payment History →
        </Link>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}

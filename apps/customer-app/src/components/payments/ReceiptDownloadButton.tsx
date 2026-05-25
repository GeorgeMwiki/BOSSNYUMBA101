'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';
import { Button, Alert, AlertDescription } from '@bossnyumba/design-system';
import { api } from '@/lib/api';

interface ReceiptDownloadButtonProps {
  readonly paymentId: string;
  readonly paymentRef?: string;
  readonly size?: 'sm' | 'default';
}

interface ReceiptResponse {
  readonly url?: string;
  readonly downloadUrl?: string;
  readonly pdf?: string;
}

/**
 * Per-payment receipt download. Fetches a signed receipt URL from the
 * gateway then opens it in a new tab (mobile browsers won't always honour
 * `download` attribute on dynamic blobs, so a new tab is the safest path
 * for PDF previews).
 */
export function ReceiptDownloadButton({
  paymentId,
  paymentRef,
  size = 'sm',
}: ReceiptDownloadButtonProps) {
  const t = useTranslations('receiptDownload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await api.payments.getReceiptUrl(paymentId)) as ReceiptResponse;
      const url = result?.url ?? result?.downloadUrl ?? result?.pdf;
      if (!url) {
        throw new Error(t('noReceiptUrl'));
      }
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('downloadFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [paymentId, t]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={handleDownload}
        disabled={loading}
        data-testid={`receipt-download-${paymentRef ?? paymentId}`}
        aria-label={t('downloadReceiptAria', { ref: paymentRef ?? paymentId })}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-3.5 w-3.5" />
        )}
        {t('receipt')}
      </Button>
      {error && (
        <Alert variant="danger" className="mt-1 w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

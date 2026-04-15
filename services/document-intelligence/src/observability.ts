/**
 * Observability helpers for the Document Intelligence service.
 *
 * Exposes framework-agnostic health, readiness and metrics producers
 * that hosts (Hono, Express, queue workers) can plug into their own
 * routers. The routes in `routes/documents.routes.ts` already mount
 * the Hono variants for the HTTP adapter. Background workers should
 * use the helpers returned here.
 */

export interface DocumentIntelligenceHealth {
  status: 'ok' | 'degraded';
  service: 'document-intelligence';
  uptimeSeconds: number;
  providers: {
    ocrPrimary: boolean;
    ocrFallback: boolean;
    storage: boolean;
  };
}

export interface DocumentIntelligenceObservability {
  health(): DocumentIntelligenceHealth;
  ready(): DocumentIntelligenceHealth;
  metrics(): string;
  recordOcr(outcome: 'ok' | 'low_confidence' | 'error'): void;
  recordFraudCheck(outcome: 'ok' | 'flagged' | 'error'): void;
}

export interface DocumentIntelligenceObservabilityOptions {
  providers: DocumentIntelligenceHealth['providers'];
}

export function createDocumentIntelligenceObservability(
  options: DocumentIntelligenceObservabilityOptions,
): DocumentIntelligenceObservability {
  const startedAt = Date.now();
  const counters = {
    ocr: { ok: 0, low_confidence: 0, error: 0 },
    fraud: { ok: 0, flagged: 0, error: 0 },
  };

  const base = (): DocumentIntelligenceHealth => ({
    status: 'ok',
    service: 'document-intelligence',
    uptimeSeconds: (Date.now() - startedAt) / 1000,
    providers: { ...options.providers },
  });

  return {
    health: () => base(),
    ready: () => {
      const h = base();
      if (!h.providers.ocrPrimary && !h.providers.ocrFallback) {
        return { ...h, status: 'degraded' };
      }
      if (!h.providers.storage) {
        return { ...h, status: 'degraded' };
      }
      return h;
    },
    metrics() {
      const uptime = (Date.now() - startedAt) / 1000;
      return [
        '# HELP document_intelligence_uptime_seconds Process uptime in seconds',
        '# TYPE document_intelligence_uptime_seconds gauge',
        `document_intelligence_uptime_seconds ${uptime.toFixed(3)}`,
        '# HELP document_intelligence_ocr_total OCR attempts by outcome',
        '# TYPE document_intelligence_ocr_total counter',
        `document_intelligence_ocr_total{outcome="ok"} ${counters.ocr.ok}`,
        `document_intelligence_ocr_total{outcome="low_confidence"} ${counters.ocr.low_confidence}`,
        `document_intelligence_ocr_total{outcome="error"} ${counters.ocr.error}`,
        '# HELP document_intelligence_fraud_total Fraud checks by outcome',
        '# TYPE document_intelligence_fraud_total counter',
        `document_intelligence_fraud_total{outcome="ok"} ${counters.fraud.ok}`,
        `document_intelligence_fraud_total{outcome="flagged"} ${counters.fraud.flagged}`,
        `document_intelligence_fraud_total{outcome="error"} ${counters.fraud.error}`,
        '',
      ].join('\n');
    },
    recordOcr(outcome) {
      counters.ocr[outcome] += 1;
    },
    recordFraudCheck(outcome) {
      counters.fraud[outcome] += 1;
    },
  };
}

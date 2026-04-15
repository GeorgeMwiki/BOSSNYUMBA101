/**
 * Security headers (helmet-equivalent) without any external dependency.
 *
 * Returns a frozen record of headers that should be applied to every HTTP
 * response. Values are conservative defaults suitable for an API that does
 * not serve HTML; callers can merge or override for HTML-serving routes.
 */

export interface SecurityHeadersConfig {
  /** Enable HSTS. Default: true. */
  readonly hsts?: boolean;
  /** HSTS max-age seconds. Default: 15552000 (180 days). */
  readonly hstsMaxAge?: number;
  /** Include subdomains in HSTS. Default: true. */
  readonly hstsIncludeSubdomains?: boolean;
  /** Include `preload` directive in HSTS. Default: false. */
  readonly hstsPreload?: boolean;
  /** Content-Security-Policy. Default: api-friendly 'none'. */
  readonly contentSecurityPolicy?: string | false;
  /** Referrer-Policy. Default: no-referrer. */
  readonly referrerPolicy?: string;
  /** Permissions-Policy. Default: minimal. */
  readonly permissionsPolicy?: string;
  /** Custom headers to merge. */
  readonly additional?: Record<string, string>;
}

/**
 * Build the security headers for a response.
 */
export function buildSecurityHeaders(
  config: SecurityHeadersConfig = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': config.referrerPolicy ?? 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Permissions-Policy':
      config.permissionsPolicy ??
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  };

  if (config.hsts !== false) {
    const parts = [`max-age=${config.hstsMaxAge ?? 15_552_000}`];
    if (config.hstsIncludeSubdomains !== false) {
      parts.push('includeSubDomains');
    }
    if (config.hstsPreload) {
      parts.push('preload');
    }
    headers['Strict-Transport-Security'] = parts.join('; ');
  }

  if (config.contentSecurityPolicy !== false) {
    headers['Content-Security-Policy'] =
      config.contentSecurityPolicy ??
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
  }

  return { ...headers, ...(config.additional ?? {}) };
}

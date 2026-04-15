/**
 * Template renderer - Handlebars-subset template engine.
 *
 *   - `{{var}}`               simple substitution (HTML-escaped for html mode)
 *   - `{{{var}}}`             raw substitution (no escaping)
 *   - `{{#var}}...{{/var}}`   conditional block (rendered when truthy)
 *   - `{{^var}}...{{/var}}`   inverted block (rendered when falsy)
 *
 * Locale fallbacks let callers provide one data bag per locale with a primary
 * locale and optional fallback locales; missing keys walk the fallback chain
 * before returning either the default value or an empty string.
 */

export type TemplateDataValue = string | number | boolean | null | undefined;
export type TemplateData = Record<string, TemplateDataValue>;

export type SupportedLocale = 'en-KE' | 'sw-TZ' | 'en-US' | 'en-GB';
export const DEFAULT_LOCALE: SupportedLocale = 'en-KE';

export interface RenderOptions {
  /** Primary locale. Defaults to `en-KE`. */
  locale?: SupportedLocale;
  /** Fallback locales consulted when the primary data bag does not have a key. */
  fallbackLocales?: readonly SupportedLocale[];
  /**
   * Per-locale data bags. Keys not found in the primary locale walk the
   * fallback chain before falling back to `defaults`.
   */
  data?: Partial<Record<SupportedLocale, TemplateData>>;
  /** Defaults consulted after exhausting locale fallbacks. */
  defaults?: TemplateData;
  /**
   * Render mode:
   *  - `text`: substitutions are inserted verbatim (used for SMS, WhatsApp,
   *    push).
   *  - `html`: substitutions are HTML-escaped; use `{{{triple}}}` to opt out
   *    of escaping for pre-rendered HTML fragments.
   */
  mode?: 'text' | 'html';
  /** Throw if a referenced variable is not found in any data source. */
  strict?: boolean;
}

/**
 * Render a template string, substituting `{{variables}}` against the locale
 * data bags.
 *
 * Accepts either a `RenderOptions` object or a legacy flat record of
 * `{ key: value }` which is treated as `defaults` in text mode.
 */
export function renderTemplate(
  text: string,
  optionsOrData: RenderOptions | TemplateData = {}
): string {
  const options: RenderOptions = isRenderOptions(optionsOrData)
    ? optionsOrData
    : { defaults: optionsOrData, mode: 'text' };
  const locale = options.locale ?? DEFAULT_LOCALE;
  const fallbackLocales = options.fallbackLocales ?? buildDefaultFallbacks(locale);
  const mode = options.mode ?? 'text';
  const strict = options.strict ?? false;

  const sources: ReadonlyArray<TemplateData | undefined> = [
    options.data?.[locale],
    ...fallbackLocales.map((l) => options.data?.[l]),
    options.defaults,
  ];

  const resolve = (key: string): TemplateDataValue => {
    for (const source of sources) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }
    if (strict) {
      throw new TemplateRenderError(`Missing template variable: "${key}"`);
    }
    return '';
  };

  // 1. Handle block helpers {{#var}}...{{/var}} / {{^var}}...{{/var}}.
  let result = renderBlocks(text, resolve);

  // 2. Substitute raw variables {{{var}}} — no HTML escaping regardless of
  // mode, but we still resolve through the locale chain.
  result = result.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_match, key: string) => {
    return toString(resolve(key));
  });

  // 3. Substitute standard variables {{var}}. In html mode these are escaped.
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = toString(resolve(key));
    return mode === 'html' ? escapeHtml(value) : value;
  });

  return result;
}

/** Error thrown when a template references a variable that is not defined in strict mode. */
export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateRenderError';
  }
}

/** Escape HTML-unsafe characters. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Heuristically detect a RenderOptions vs. a legacy flat data record. RenderOptions
 * exposes one of the well-known keys; flat data records contain string/number/boolean
 * primitives keyed by arbitrary names.
 */
function isRenderOptions(value: RenderOptions | TemplateData): value is RenderOptions {
  if (value === null || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return true; // empty is a valid (no-op) RenderOptions
  return keys.some((k) => k === 'locale' || k === 'fallbackLocales' || k === 'data' || k === 'defaults' || k === 'mode' || k === 'strict');
}

function buildDefaultFallbacks(primary: SupportedLocale): readonly SupportedLocale[] {
  // Common-sense locale walk for East African + English regions.
  const chains: Record<SupportedLocale, readonly SupportedLocale[]> = {
    'sw-TZ': ['en-KE', 'en-US'],
    'en-KE': ['en-US'],
    'en-GB': ['en-US'],
    'en-US': [],
  };
  return chains[primary];
}

function toString(value: TemplateDataValue): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : '';
  return String(value);
}

function isTruthy(value: TemplateDataValue): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'boolean') return value;
  return true;
}

/**
 * Render block helpers. Supports `{{#var}}...{{/var}}` (truthy guard) and
 * `{{^var}}...{{/var}}` (falsy guard). Blocks do not nest with the same key.
 */
function renderBlocks(text: string, resolve: (key: string) => TemplateDataValue): string {
  const blockRegex = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g;
  let previous = '';
  let current = text;
  // Iterate until a pass produces no further substitutions — this lets nested
  // blocks of different keys resolve cleanly without recursion tricks.
  while (previous !== current) {
    previous = current;
    current = current.replace(blockRegex, (_match, kind: string, key: string, inner: string) => {
      const truthy = isTruthy(resolve(key));
      const include = kind === '#' ? truthy : !truthy;
      return include ? inner : '';
    });
  }
  return current;
}

/**
 * Back-compat helper: accept a plain data object (no locale awareness) and
 * render with the default locale in text mode. Existing call-sites that pass
 * `renderTemplate(text, data)` continue to work.
 */
export function renderTemplateSimple(
  text: string,
  data: Record<string, string | number | boolean | null | undefined>
): string {
  return renderTemplate(text, {
    defaults: data as TemplateData,
    mode: 'text',
  });
}

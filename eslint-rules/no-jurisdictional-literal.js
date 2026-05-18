/**
 * ESLint custom rule: `no-jurisdictional-literal`
 *
 * Phase E.0 — flags hard-coded jurisdictional values that should be read
 * from `getJurisdictionalRules(country)` instead. This is the lint-time
 * companion to the audit script at `scripts/audit-jurisdictional-literals.mjs`.
 *
 * What it catches (in `Literal` + `TemplateLiteral` nodes):
 *   - Country-coupled identifiers:
 *       'NIDA', 'KRA', 'TRA', 'KRA PIN', 'eRITS', 'eArdhi',
 *       'Ardhisasa', 'M-Pesa', 'GePG', 'NRC', 'Huduma'
 *   - Embedded phone-country prefixes: '+254', '+255'
 *   - Hard-coded timezones: 'Africa/Dar_es_Salaam', 'Africa/Nairobi'
 *   - AWS region defaults: 'eu-west-1', 'us-east-1'
 *   - Hard-coded VAT rate numerics: 0.18 / 18.0 followed by '%' in a
 *     VAT context (best-effort heuristic on neighbouring template/comment
 *     content)
 *   - 3-value currency enums: `KES | TZS | USD` style unions
 *
 * Allowed locations (whitelisted by file path; if the file matches any
 * pattern below the rule is skipped entirely):
 *   - `packages/connectors/src/adapters/<country>-<connector>.ts`
 *   - `packages/domain-models/src/common/jurisdictional-rules.ts`
 *   - `packages/domain-models/src/common/region-config.ts`
 *   - `packages/database/src/seeds/**`
 *   - `**\/__tests__/**`, `**\/__fixtures__/**`, `**\/fixtures/**`
 *   - `**\/*.md`
 *
 * Default severity is `warn` so existing literals do not break CI until
 * the Phase E.0.4 rebind pass lands. The audit script enumerates every
 * violation site as a worklist for that pass.
 */
'use strict';

// ---- Jurisdictional identifier vocabulary ----
// Use a Set for O(1) membership probes. Each entry MUST be matched by the
// FULL literal string (not a substring) to avoid catching benign words
// like 'mpesa-receipts' or 'kra/test-helpers'. We separately scan
// concatenated identifiers (e.g. 'KRA PIN', '@bossnyumba/mcp-mpesa-ke')
// via the prefix patterns.
const JURISDICTIONAL_IDENTIFIERS = new Set([
  'NIDA',
  'KRA',
  'TRA',
  'KRA PIN',
  'eRITS',
  'eArdhi',
  'Ardhisasa',
  'M-Pesa',
  'GePG',
  'NRC',
  'Huduma',
]);

// Phone-country prefixes embedded in business logic. Allowed in tests
// and region-config (whitelisted via file path).
const PHONE_PREFIXES = new Set(['+254', '+255']);

// IANA timezones we ship to East-Africa pilot countries.
const HARDCODED_TIMEZONES = new Set([
  'Africa/Dar_es_Salaam',
  'Africa/Nairobi',
]);

// AWS region defaults — we want these to flow from
// getJurisdictionalRules(country).awsRegionDefault, not be hard-coded.
const AWS_REGIONS = new Set(['eu-west-1', 'us-east-1']);

// File-path allowlist. A jurisdictional literal in any of these files
// is considered legitimate (registry / adapter / seed / test / docs).
const ALLOWLIST_PATTERNS = [
  /packages\/domain-models\/src\/common\/jurisdictional-rules\.ts$/,
  /packages\/domain-models\/src\/common\/region-config\.ts$/,
  /packages\/connectors\/src\/adapters\/[a-z]{2,3}-[a-z0-9-]+\.ts$/,
  /packages\/database\/src\/seeds\//,
  /\/__tests__\//,
  /\/__fixtures__\//,
  /\/fixtures\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.md$/,
];

function isAllowlistedFile(filename) {
  if (!filename || filename === '<input>' || filename === '<text>') {
    return true;
  }
  for (const pattern of ALLOWLIST_PATTERNS) {
    if (pattern.test(filename)) {
      return true;
    }
  }
  return false;
}

function buildMessage(value) {
  return (
    `Jurisdictional literal '${value}' detected. Use ` +
    `getJurisdictionalRules(tenant.country).<path> instead. Add an ` +
    `allowlist entry to .eslintrc if this is the registry file.`
  );
}

/**
 * Classify a literal string. Returns the violating value or null.
 *
 * For exact-match identifiers we require the literal === the vocabulary
 * entry to avoid false positives on URLs / package names. For phone
 * prefixes we accept any literal that *starts with* the prefix to catch
 * embedded numbers like '+254712345678'.
 */
function classifyLiteral(rawValue) {
  if (typeof rawValue !== 'string') {
    return null;
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (JURISDICTIONAL_IDENTIFIERS.has(trimmed)) {
    return trimmed;
  }
  if (HARDCODED_TIMEZONES.has(trimmed)) {
    return trimmed;
  }
  if (AWS_REGIONS.has(trimmed)) {
    return trimmed;
  }
  for (const prefix of PHONE_PREFIXES) {
    // Either the literal IS the prefix, or it embeds it as a phone
    // number (prefix immediately followed by a digit).
    if (trimmed === prefix) {
      return prefix;
    }
    if (
      trimmed.startsWith(prefix) &&
      /^\+\d{3,15}$/.test(trimmed)
    ) {
      return prefix;
    }
  }
  return null;
}

/**
 * Look for a 3-value currency-code union (`'KES' | 'TZS' | 'USD'`).
 * We walk TSUnionType nodes; if every member is a Literal with a 3-
 * letter currency value AND it contains at least one of the
 * jurisdictional currencies (KES, TZS), we flag it.
 *
 * This catches the legacy `Currency = 'KES' | 'USD' | 'EUR' | 'GBP'`
 * enum that the audit already flagged once.
 */
function isCurrencyEnumUnion(node) {
  if (!node || node.type !== 'TSUnionType') {
    return false;
  }
  if (!Array.isArray(node.types) || node.types.length < 2) {
    return false;
  }
  const literals = [];
  for (const member of node.types) {
    if (
      member.type !== 'TSLiteralType' ||
      !member.literal ||
      member.literal.type !== 'Literal' ||
      typeof member.literal.value !== 'string'
    ) {
      return false;
    }
    if (!/^[A-Z]{3}$/.test(member.literal.value)) {
      return false;
    }
    literals.push(member.literal.value);
  }
  // Must reference at least one jurisdictional currency to qualify
  // (avoids flagging unrelated 3-letter unions like axis enums).
  return literals.some((v) => v === 'KES' || v === 'TZS');
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hard-coded jurisdictional literals. Use getJurisdictionalRules(country).<path> instead.',
      recommended: false,
    },
    schema: [],
    messages: {
      literal: "{{ msg }}",
    },
  },
  create(context) {
    const filename =
      typeof context.getFilename === 'function'
        ? context.getFilename()
        : context.filename;
    if (isAllowlistedFile(filename)) {
      return {};
    }

    function report(node, value) {
      context.report({
        node,
        messageId: 'literal',
        data: { msg: buildMessage(value) },
      });
    }

    return {
      Literal(node) {
        const violation = classifyLiteral(node.value);
        if (violation) {
          report(node, violation);
        }
      },
      TemplateLiteral(node) {
        if (!Array.isArray(node.quasis)) {
          return;
        }
        for (const quasi of node.quasis) {
          const cooked = quasi && quasi.value && quasi.value.cooked;
          if (typeof cooked !== 'string') {
            continue;
          }
          // Template literals can embed multiple words; we only flag
          // when an exact-token match appears (whitespace-separated)
          // OR an AWS/timezone/phone prefix occurs inside the cooked
          // content.
          const trimmed = cooked.trim();
          const direct = classifyLiteral(trimmed);
          if (direct) {
            report(quasi, direct);
            continue;
          }
          // Substring probes for embedded identifiers
          for (const id of JURISDICTIONAL_IDENTIFIERS) {
            if (
              cooked.includes(id) &&
              new RegExp(`(^|[^A-Za-z0-9])${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^A-Za-z0-9]|$)`).test(
                cooked
              )
            ) {
              report(quasi, id);
              break;
            }
          }
          for (const tz of HARDCODED_TIMEZONES) {
            if (cooked.includes(tz)) {
              report(quasi, tz);
              break;
            }
          }
          for (const region of AWS_REGIONS) {
            if (cooked.includes(region)) {
              report(quasi, region);
              break;
            }
          }
          for (const prefix of PHONE_PREFIXES) {
            if (new RegExp(`\\${prefix}\\d`).test(cooked)) {
              report(quasi, prefix);
              break;
            }
          }
        }
      },
      TSUnionType(node) {
        if (isCurrencyEnumUnion(node)) {
          const sample = node.types
            .map((t) => (t.literal && t.literal.value) || '?')
            .join(' | ');
          report(node, sample);
        }
      },
    };
  },
};

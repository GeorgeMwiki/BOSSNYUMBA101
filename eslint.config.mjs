/**
 * Root ESLint flat-config for the BOSSNYUMBA monorepo.
 *
 * Migrated from the legacy `.eslintrc.cjs` (ESLint 8.x) to flat-config for
 * ESLint 10.x. Every per-package `pnpm lint` script resolves this file via
 * cosmiconfig because flat-config is the only supported format on ESLint 10.
 *
 * Enforces security best practices at lint time:
 *  - eslint-plugin-security: well-known injection / insecure-API rules
 *  - eslint-plugin-no-secrets: entropy-based secret detection in source
 *  - no-console (warn) everywhere except tests + explicit console.warn/error
 *  - no-eval / no-implied-eval: hard-errors
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import securityPlugin from 'eslint-plugin-security';
import noSecretsPlugin from 'eslint-plugin-no-secrets';
import globals from 'globals';

const NO_SECRETS_OPTIONS = {
  tolerance: 4.5,
  additionalRegexes: {
    // Stripe-style keys
    'Stripe Secret Key': 'sk_(test|live)_[0-9a-zA-Z]{16,}',
    'Stripe Publishable Key': 'pk_(test|live)_[0-9a-zA-Z]{16,}',
    // OpenAI / Anthropic / Google
    'OpenAI API Key': 'sk-(proj-)?[A-Za-z0-9_-]{20,}',
    'Anthropic API Key': 'sk-ant-(api|admin)\\d{2}-[A-Za-z0-9_-]{20,}',
    'Google API Key': 'AIza[0-9A-Za-z_-]{35}',
    // AWS
    'AWS Access Key ID': 'AKIA[0-9A-Z]{16}',
    'AWS Secret Access Key':
      'aws_secret_access_key[\\s"\':=]+[A-Za-z0-9/+=]{40}',
    // Generic private keys
    'Private Key Block':
      '-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY',
    // JWT
    'JWT Token':
      'eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
    // GitHub
    'GitHub PAT': 'gh[pousr]_[A-Za-z0-9]{36,}',
    // Slack
    'Slack Token': 'xox[aboprs]-[A-Za-z0-9-]{10,}',
    // Project-specific: GePG / M-Pesa style tokens often prefixed
    'GePG Token': 'GEPG_(API|SECRET)_[A-Za-z0-9]{20,}',
  },
  ignoreContent: [
    'xxxxx',
    'placeholder',
    'example',
    'your-key-here',
    'changeme',
  ],
  ignoreIdentifiers: [],
};

export default [
  // ------ Ignore patterns (migrated from `ignorePatterns`) ------
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.blob/**',
      '**/e2e-report/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.tsbuildinfo',
      // Flutter app is not JS
      'apps/bossnyumba_app/**',
      // Generated / vendored
      '**/generated/**',
      '**/*.generated.ts',
      '**/*.generated.tsx',
      '**/*.d.ts',
    ],
  },

  // ------ Base: eslint:recommended ------
  js.configs.recommended,

  // ------ TypeScript baseline (typescript-eslint v8 flat-config bundle) ------
  // We deliberately do NOT extend `tseslint.configs.recommended` (it would
  // introduce hundreds of new errors). We only attach the parser + plugin so
  // existing rules continue to work as they did under the legacy config.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Delegate to TS compiler; ESLint core rules conflict with TS
      // namespace/type merging and type-level checks.
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
    },
  },

  // ------ Core rules + security + no-secrets (apply to all JS/TS sources) ------
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      security: securityPlugin,
      'no-secrets': noSecretsPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      // ---- Hard security ----
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // ---- Console discipline ----
      // Allow warn/error (operational signals) but flag info/log/debug so they
      // get routed through @bossnyumba/observability instead.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // ---- Secret detection ----
      'no-secrets/no-secrets': ['error', NO_SECRETS_OPTIONS],

      // ---- Security plugin tuning ----
      // Object-injection is noisy on TS with typed keys; keep as warn so CI
      // surfaces it but doesn't block legitimate typed array access.
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-child-process': 'error',
      'security/detect-non-literal-regexp': 'warn',
      // detect-unsafe-regex (safe-regex) has many false positives on bounded
      // alternation patterns like `(?:a|b|c)` — flag-as-warn so CI surfaces
      // them for human review without blocking on cosmetic regex shape.
      'security/detect-unsafe-regex': 'warn',
      // no-useless-escape is auto-fixable in regexes but not in string
      // literals (case-study text uses \' liberally). Demote to warn so the
      // ~50 case-study string-escape annotations don't block CI.
      'no-useless-escape': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-bidi-characters': 'error',

      // TS handles unused-vars better than core rule
      'no-unused-vars': 'off',
    },
  },

  // ------ Tests ------
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
      '**/test/**/*.ts',
      '**/tests/**/*.ts',
      '**/e2e/**/*.ts',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      'no-secrets/no-secrets': 'off',
    },
  },

  // ------ Config / build / script files ------
  {
    files: [
      '**/*.config.ts',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/scripts/**/*.ts',
      '**/scripts/**/*.js',
    ],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'warn',
    },
  },

  // ------ Documentation / fixtures ------
  {
    files: ['**/fixtures/**', '**/__fixtures__/**'],
    rules: {
      'no-secrets/no-secrets': 'off',
    },
  },
];

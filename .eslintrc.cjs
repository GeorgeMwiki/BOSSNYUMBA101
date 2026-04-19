/**
 * Root ESLint config for the BOSSNYUMBA monorepo.
 *
 * Enforces security best practices at commit time:
 *  - eslint-plugin-security: well-known injection / insecure-API rules
 *  - eslint-plugin-no-secrets: entropy-based secret detection in source
 *  - no-console (warn) everywhere except tests + explicit console.warn/error
 *  - no-eval / no-implied-eval: hard-errors
 *
 * Per-package configs only need to extend this one and opt into a parser
 * (`@typescript-eslint/parser`). This file uses the classic rc format because
 * the repo is on ESLint 8.x.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  plugins: ['@typescript-eslint', 'security', 'no-secrets'],
  extends: ['eslint:recommended', 'plugin:security/recommended-legacy'],
  reportUnusedDisableDirectives: true,
  settings: {},
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
    'no-secrets/no-secrets': [
      'error',
      {
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
          // Documentation examples / placeholders
          'xxxxx',
          'placeholder',
          'example',
          'your-key-here',
          'changeme',
        ],
        ignoreIdentifiers: [],
      },
    ],

    // ---- Security plugin tuning ----
    // Object-injection is noisy on TS with typed keys; keep as warn so CI
    // surfaces it but doesn't block legitimate typed array access.
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-child-process': 'error',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-unsafe-regex': 'error',
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
  overrides: [
    // ------ TypeScript sources ------
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        // Delegate to TS compiler; eslint core rules conflict with TS
        // namespace/type merging and type-level checks.
        'no-undef': 'off',
        'no-redeclare': 'off',
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
      env: {
        node: true,
      },
      globals: {
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
    // ------ Documentation / fixtures (if ever linted) ------
    {
      files: ['**/*.md', '**/fixtures/**', '**/__fixtures__/**'],
      rules: {
        'no-secrets/no-secrets': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.next/',
    '.turbo/',
    '.blob/',
    'e2e-report/',
    'playwright-report/',
    'test-results/',
    '*.tsbuildinfo',
    // Flutter app is not JS
    'apps/bossnyumba_app/',
    // Generated / vendored
    '**/generated/**',
    '**/*.generated.ts',
    '**/*.generated.tsx',
    '**/*.d.ts',
  ],
};

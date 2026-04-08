/**
 * ESLint config for @bossnyumba/owner-portal (Vite + React SPA).
 *
 * `plugin:jsx-a11y/recommended` is the authoring-time companion to the
 * @axe-core/playwright runtime scans in e2e/a11y. CI runs `pnpm lint` and will
 * fail on any jsx-a11y violation — do NOT add individual disable comments
 * without a linked accessibility ticket.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.ts', '*.config.js'],
};

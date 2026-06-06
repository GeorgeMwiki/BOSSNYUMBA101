/**
 * Marketing-surface ESLint flat-config.
 *
 * Inherits the root monorepo flat-config (see ../../eslint.config.mjs) and
 * registers `eslint-plugin-react-hooks` so that inline directives like
 * `// eslint-disable-next-line react-hooks/exhaustive-deps` resolve
 * correctly under the root config's `reportUnusedDisableDirectives: true`
 * setting. Without the plugin loaded, ESLint 10 hard-errors with
 * "Definition for rule 'react-hooks/exhaustive-deps' was not found", which
 * fails both `next lint` and `next build`.
 *
 * The plugin is intentionally scoped to this app (and the other React
 * surfaces) rather than the root config — the broader monorepo includes
 * non-React packages (services, codegen, infra) for which the rule would
 * be meaningless and the plugin's parser overhead is unwanted. This mirrors
 * apps/staff-mobile/eslint.config.mjs.
 *
 * Persona: Mr. Mwikila
 */

import rootConfig from '../../eslint.config.mjs';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // Match React's recommended hooks rules without escalating severity.
      // exhaustive-deps stays `warn` so the existing inline disable
      // directives remain meaningful (e.g. MarketingFooter's locale-derived
      // useMemo) but don't block CI on hooks-deps shape.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

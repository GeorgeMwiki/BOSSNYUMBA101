/**
 * Local ESLint plugin bundling BOSSNYUMBA-specific custom rules.
 *
 * Loaded by `eslint.config.mjs` as the `bossnyumba` plugin. New rules
 * should be:
 *   1. Implemented in a sibling `<rule-name>.js` file.
 *   2. Exported here under `rules['<rule-name>']`.
 *   3. Documented in the rule file header + referenced from JURISDICTIONAL-RULES.md
 *      when relevant.
 */
'use strict';

const noJurisdictionalLiteral = require('./no-jurisdictional-literal.js');

module.exports = {
  rules: {
    'no-jurisdictional-literal': noJurisdictionalLiteral,
  },
};

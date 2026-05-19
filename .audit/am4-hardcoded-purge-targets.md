# AM-4 Hardcoded Fallback Purge — Hit-List

**Base**: 7725eaa9
**Branch**: claude/am4-hardcoded-fallback-purge
**Date**: 2026-05-19

## Bucket counts (BEFORE)

| Bucket | Count |
|--------|-------|
| 1. Mock data | 16 |
| 2. Hardcoded currencies | 615 |
| 3. Hardcoded locales | 71 |
| 4. Jurisdiction equality | 9 |
| 5. Provider names | 135 |
| 6. Tax rates | 34 |
| 7. Silent fallbacks | 1 |

---

## Bucket 1: Mock data hits

```
packages/market-intelligence/src/index.ts:34:  ZILLOW_MOCK_HEADER,
packages/market-intelligence/src/index.ts:39:  AIRBNB_MOCK_HEADER,
packages/market-intelligence/src/adapters/airbnb.ts:31:const MOCK_HEADER = 'X-MOCK-MARKET-DATA';
packages/market-intelligence/src/adapters/airbnb.ts:357:export { MOCK_HEADER as AIRBNB_MOCK_HEADER };
packages/market-intelligence/src/adapters/zillow.ts:42:const MOCK_HEADER = 'X-MOCK-MARKET-DATA';
packages/market-intelligence/src/adapters/zillow.ts:375:export { MOCK_HEADER as ZILLOW_MOCK_HEADER };
apps/customer-app/src/lib/payments-data.ts:6:export const MOCK_PAYMENTS: Payment[] = [];
services/api-gateway/src/middleware/database.ts:64:const EXPLICIT_MOCK_MODE = process.env.USE_MOCK_DATA === 'true';
services/api-gateway/src/middleware/database.ts:66:if (IS_PRODUCTION && EXPLICIT_MOCK_MODE) {
services/api-gateway/src/middleware/database.ts:67:  throw new Error('USE_MOCK_DATA is not allowed in production');
services/api-gateway/src/middleware/database.ts:74:const USE_MOCK_DATA = EXPLICIT_MOCK_MODE || !DATABASE_URL;
services/api-gateway/src/middleware/database.ts:93:  if (USE_MOCK_DATA) {
services/api-gateway/src/middleware/database.ts:287:  const useMockData = !preInjectedDb && (USE_MOCK_DATA || !database);
services/api-gateway/src/middleware/database.ts:344:  return USE_MOCK_DATA || !getDatabase();
services/api-gateway/test/integration/helpers/test-env.ts:40:process.env.USE_MOCK_DATA = 'false';
services/api-gateway/src/config/validate-env.ts:148:  USE_MOCK_DATA: z.enum(['true', 'false']).optional(),
```

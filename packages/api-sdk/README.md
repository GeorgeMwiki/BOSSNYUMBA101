# @bossnyumba/api-sdk

Typed HTTP SDK for the BossNyumba Gateway API. Types are auto-generated from
`Docs/api/openapi.generated.json` via `openapi-typescript`. The hand-written
client wrapper layers in auth, timeouts, URL building, and structured errors.

## Install (inside the monorepo)

```ts
import { createBossnyumbaClient, ApiSdkError } from '@bossnyumba/api-sdk';

const client = createBossnyumbaClient({
  baseUrl: 'http://localhost:4001',
  // Static token OR a function that refreshes the JWT on each call.
  bearerToken: async () => getAccessToken(),
  timeoutMs: 10_000,
});

try {
  const listings = await client.marketplace.listings.list({ page: 1, limit: 20 });
  console.log(listings);
} catch (err) {
  if (err instanceof ApiSdkError) {
    console.error(`gateway said ${err.code} @ ${err.status}: ${err.message}`);
  }
}
```

## Regenerating types

Run after any OpenAPI change (the `openapi-drift` CI workflow enforces this):

```bash
pnpm -C packages/api-sdk generate
pnpm -C packages/api-sdk build
```

## Error handling

All non-2xx responses throw `ApiSdkError` which carries `status`, `code`,
`requestId` (if the gateway emits one), and any `details` payload.

## Not included

- No React hooks — use `@bossnyumba/api-client` for React-specific helpers.
- No automatic retries — wrap the SDK in `@bossnyumba/lpms-connector`'s
  retry helpers if you need them.

# @bossnyumba/config

Centralized, typed environment + feature-flag configuration for the BOSSNYUMBA
platform.

This package has **no runtime dependencies** other than `zod` and is safe to
import from both Node services and browser apps.

---

## Exports

| Subpath | Purpose |
|---|---|
| `@bossnyumba/config` | Main: `getConfig()`, validated env accessors, re-exports |
| `@bossnyumba/config/schemas` | Raw Zod schemas for env validation |
| `@bossnyumba/config/feature-flags` | Typed feature-flag API |

---

## Feature Flags

### Quick start

```ts
import { isEnabled, FF } from '@bossnyumba/config/feature-flags';

if (await isEnabled(FF.AI_COPILOT, tenantId, userId)) {
  renderCopilot();
}
```

Or synchronously (env + default only, no DB lookup):

```ts
import { isEnabledSync, FF } from '@bossnyumba/config/feature-flags';

const showMap = isEnabledSync(FF.PORTFOLIO_MAP);
```

### Resolution order

1. **Environment variable** — e.g. `FF_AI_COPILOT=true`. Accepts
   `true/false/1/0/yes/no/on/off/enabled/disabled` (case-insensitive).
2. **Registered DB loader** — if a loader is registered and returns
   `true`/`false` for the given `{ tenantId, userId }` context.
3. **Static default** — every flag defaults to `false` in `FLAG_REGISTRY`.

Env overrides trump DB values. This is deliberate: ops can always force a
flag on/off without a database round-trip.

### Known flags

| Flag | Default | Maturity | Purpose |
|---|---|---|---|
| `FF_AI_COPILOT` | off | scaffolded | AI Copilot sidebar in owner / admin portals |
| `FF_OFFLINE_MODE` | off | planned | Offline-first capture + sync (field app) |
| `FF_VOICE_REPORTS` | off | scaffolded | Voice dictation for maintenance / inspection reports |
| `FF_PORTFOLIO_MAP` | off | scaffolded | Geo map view of owner portfolio |
| `FF_AI_BRIEFINGS` | off | planned | Daily AI-generated owner briefing |
| `FF_MULTI_ORG_SWITCHER` | off | scaffolded | Org switcher for multi-tenant users |
| `FF_ETIMS_INTEGRATION` | off | planned | KRA eTIMS tax invoicing (Kenya) |
| `FF_TRA_INTEGRATION` | off | planned | Tanzania Revenue Authority integration |
| `FF_PUSH_NOTIFICATIONS` | off | scaffolded | FCM/APNS push notifications |

The full registry (with descriptions) is exported as `FLAG_REGISTRY`.

### Registering a DB loader

The package never imports `@bossnyumba/database` directly — that would create
a circular dependency. Instead, each service registers its own loader at
bootstrap:

```ts
// services/api-gateway/src/bootstrap.ts
import { registerFeatureFlagLoader } from '@bossnyumba/config/feature-flags';
import { getDb } from '@bossnyumba/database';

registerFeatureFlagLoader(async (flag, { tenantId, userId }) => {
  const db = getDb();
  // user > tenant > global precedence
  const row = await db.query.featureFlags.findFirst({
    where: (t, { and, or, eq, isNull }) =>
      and(
        eq(t.name, flag),
        or(
          eq(t.userId, userId ?? ''),
          eq(t.tenantId, tenantId ?? ''),
          and(isNull(t.tenantId), isNull(t.userId))
        )
      ),
    orderBy: (t, { desc }) => [desc(t.userId), desc(t.tenantId)],
  });
  return row?.enabled; // returning undefined = "no opinion"
});
```

The expected table shape (when you create the migration):

```
CREATE TABLE feature_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  tenant_id   uuid NULL,
  user_id     uuid NULL,
  enabled     boolean NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, tenant_id, user_id)
);
```

Until such a table exists the loader can safely be omitted — `isEnabled` will
still work, returning `env` or the static default.

### Failure semantics

- If the loader throws, the failure is swallowed and resolution falls through
  to the static default. A bad DB cannot wedge the request path.
- Unknown flags (not in `KNOWN_FLAGS`) will not type-check. Cast only if you
  truly need dynamic access.

### Testing

Use `isEnabledSync` for deterministic tests: set `process.env.FF_XYZ` in the
test's setup and assert the branch.

```ts
beforeEach(() => { process.env.FF_AI_COPILOT = 'true'; });
afterEach(() => { delete process.env.FF_AI_COPILOT; });
```

---

## Environment config

See `src/schemas.ts` for the full validated env surface and `.env.example`
in the repo root for the canonical variable list.

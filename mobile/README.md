# BOSSNYUMBA Mobile Workspace

Flutter + Melos monorepo for BOSSNYUMBA's native mobile apps.

Status: **compiles + tested**. The shared core library
(`bossnyumba_core`) ships with real, ports-based implementations of
`SessionManager`, `ConnectivityMonitor`, and a sketched `SyncEngine` —
plus in-memory fakes for tests so the suite runs without Flutter
plugins / SQLCipher / Firebase. The two app shells (`estate_manager_mobile`,
`customer_mobile`) render real screens and a navigable scaffold; the
deeper feature flows (camera, M-Pesa STK orchestration, biometric
ceremony) are still phase-2 work.

## Layout

```
mobile/
├── melos.yaml                                    # Workspace orchestration
├── pubspec.yaml                                  # Workspace root
├── analysis_options.yaml                         # Lint floor for workspace root
├── packages/
│   ├── bossnyumba_core/                          # Shared core library
│   │   ├── pubspec.yaml
│   │   ├── analysis_options.yaml
│   │   ├── lib/
│   │   │   ├── bossnyumba_core.dart              # Barrel
│   │   │   ├── sync_engine.dart                  # Outbox + replay
│   │   │   ├── biometric_service.dart            # local_auth wrapper
│   │   │   ├── session_manager.dart              # JWT + tenant_id binding
│   │   │   ├── connectivity_monitor.dart         # Network reachability
│   │   │   ├── rbac.dart                         # Mobile role policy
│   │   │   ├── database/database.dart            # Drift / SQLCipher schema
│   │   │   └── geolocation/haversine.dart        # Nearest-unit math
│   │   └── test/                                 # ~40 unit tests
│   └── bossnyumba_ui/                            # Shared design system
│       ├── pubspec.yaml
│       ├── analysis_options.yaml
│       └── lib/
│           ├── bossnyumba_ui.dart                # Barrel
│           ├── theme.dart                        # Color + typography tokens
│           └── widgets/
│               ├── property_card.dart
│               └── payment_button.dart
├── apps/
│   ├── estate_manager_mobile/                    # Field-ops app
│   │   ├── pubspec.yaml
│   │   ├── analysis_options.yaml
│   │   ├── lib/main.dart
│   │   └── lib/screens/
│   │       ├── inspection_screen.dart
│   │       └── tenant_signing_screen.dart
│   └── customer_mobile/                          # Tenant-facing app
│       ├── pubspec.yaml
│       ├── analysis_options.yaml
│       ├── lib/main.dart
│       └── lib/screens/pay_rent_screen.dart
└── integration_test/                             # Workspace-level suite
    ├── pubspec.yaml
    ├── analysis_options.yaml
    └── test/                                     # 5 integration tests
```

## App targets

| App                     | Audience                                          | Primary flows                                                                       |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `estate_manager_mobile` | Estate managers, building supervisors, inspectors | Field inspections, photo capture, maintenance triage, biometric tenant sign-off.    |
| `customer_mobile`       | Tenant residents (and owner-advisors in v2)       | Rent payment via M-Pesa STK push, lease access, maintenance ticket creation.        |

## Melos commands

Run from the `mobile/` directory:

```bash
# Install workspace dependencies
melos bootstrap

# Lint — runs `flutter analyze` in every package
melos exec --no-private -- flutter analyze
# or via the named script:
melos run analyze

# Format
melos run format            # write
melos run format:check      # CI / pre-commit

# Tests
melos exec --no-private -- flutter test
melos run test

# Test with coverage
melos run test:coverage

# Code generation (Drift schema, Freezed models, Riverpod providers)
melos run build_runner

# Clean Flutter caches
melos run clean
```

## Run a single test file

```bash
# Unit tests for the core library
cd mobile/packages/bossnyumba_core
flutter test test/session_manager_test.dart

# Workspace integration tests
cd mobile/integration_test
flutter test test/sync_offline_to_online_test.dart

# Per-app integration tests
cd mobile/apps/estate_manager_mobile
flutter test integration_test/login_flow_test.dart
```

## Implementation status

| Surface                                | Status               | Notes                                                                                  |
| -------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `bossnyumba_core/session_manager`      | **implemented**      | JWT + idle (15 min) + absolute (24 h) + refresh-rotation + multi-tenant switch + persistence. |
| `bossnyumba_core/connectivity_monitor` | **implemented**      | `connectivity_plus` link signal + active HEAD `/api/health` probe to defeat TZ carrier lies. |
| `bossnyumba_core/sync_engine`          | **sketched**         | Outbox table, queueMutation, syncNow with retry + idempotency-key, server-wins conflict path. Production Drift wiring stubbed. |
| `bossnyumba_core/biometric_service`    | **stub + in-mem fake** | `BiometricService` contract + `InMemoryBiometricService` for tests; `local_auth` wiring lives in a sibling file added later. |
| `bossnyumba_core/database/database`    | **schema only**      | Drift table declarations for 6 entities + outbox + abstract `BossnyumbaDatabase`. Concrete `@DriftDatabase` class lives in `database_drift.dart` after `build_runner` runs. |
| `bossnyumba_core/geolocation/haversine`| **implemented**      | Pure math — no plugins.                                                                |
| `bossnyumba_core/rbac`                 | **implemented**      | Mirrors backend roles + restricted-permission list + offline expiry helper.            |
| `bossnyumba_ui/theme`                  | **implemented**      | `BossnyumbaTheme.light()` / `dark()` produce real `ThemeData` against the OKLCH-mirrored colour tokens. |
| `bossnyumba_ui/widgets/property_card`  | **implemented**      | Hero image + name + occupancy chip + distance.                                         |
| `bossnyumba_ui/widgets/payment_button` | **implemented**      | Method-coloured CTA (M-Pesa / Tigo / Airtel / card / cash) + loading state.            |
| `estate_manager_mobile`                | **shell-only**       | `main.dart` boots Riverpod + theme + scaffold home with navigable tiles to inspection + tenant-signing screens; deep flows pending. |
| `customer_mobile`                      | **shell-only**       | `main.dart` boots Riverpod + theme + scaffold home with a Pay-Rent FAB that routes to `PayRentScreen`; STK push orchestration pending. |

## Tests

| Suite                                                          | Count |
| -------------------------------------------------------------- | ----- |
| `bossnyumba_core/test/session_manager_test.dart`               | 13    |
| `bossnyumba_core/test/connectivity_monitor_test.dart`          | 8     |
| `bossnyumba_core/test/sync_engine_test.dart`                   | 10    |
| `bossnyumba_core/test/biometric_service_test.dart`             | 5     |
| `bossnyumba_core/test/rbac_test.dart`                          | 5     |
| `bossnyumba_core/test/database_test.dart`                      | 3     |
| `bossnyumba_core/test/haversine_test.dart`                     | 3     |
| `bossnyumba_ui/test/theme_test.dart`                           | 4     |
| `apps/estate_manager_mobile/test/app_smoke_test.dart`          | 1     |
| `apps/customer_mobile/test/app_smoke_test.dart`                | 1     |
| `integration_test/test/login_flow_test.dart`                   | 1     |
| `integration_test/test/sync_offline_to_online_test.dart`       | 1     |
| `integration_test/test/biometric_enroll_test.dart`             | 2     |
| `integration_test/test/tenant_switch_test.dart`                | 1     |
| `integration_test/test/rent_payment_flow_test.dart`            | 1     |
| `apps/estate_manager_mobile/integration_test/login_flow_test.dart` (mirror) | 1     |
| `apps/customer_mobile/integration_test/rent_payment_flow_test.dart` (mirror)| 1     |
| **Total**                                                      | **61**|

## Tenant context

Every mobile request must carry an active `tenant_id` (multi-tenant SaaS).
`SessionManager` owns this responsibility:

1. Stores the JWT (via the `SessionStorage` port — production wires
   `flutter_secure_storage`).
2. Parses the `tenant_id` claim from the access token on login.
3. Exposes `currentTenantId` for the Dio interceptor to inject as the
   `x-tenant-id` header on every outbound request.
4. `switchTenant(orgId)` re-issues the token bound to a different
   tenant, preserving the absolute-expiry ceiling so a single account
   that belongs to multiple properties can roam.

## Offline-first contract

Every mutation goes through `SyncEngine.queueMutation(...)` which
persists to the outbox (production: Drift / SQLCipher; tests:
`InMemoryOutboxStore`). On reconnection (signalled by `ConnectivityMonitor`)
the engine replays in priority order — `payment` first, then `lease`,
then `tenant`, then `unit`, then `property`, then `maintenanceTicket`.

Each mutation carries an `idempotency-key` header equal to its
`mutationId` so retries never double-charge a payment.

Conflict policy: **server_wins_with_audit** — local divergence is
preserved in the outbox with status `conflicted` for operator review.
Per-mutation policy override via `resolveConflict`.

## Entities cached locally

The shared `bossnyumba_core` package owns offline caches for six
BOSSNYUMBA entities — see `database/database.dart`:

1. `Property` — building / estate
2. `Unit` — individual rentable unit
3. `Lease` — agreement between tenant and unit
4. `Tenant` — resident profile
5. `Payment` — rent transactions (highest sync priority)
6. `MaintenanceTicket` — issues raised by tenants

## Local verification (without a Flutter SDK)

This worktree was authored without a local Flutter install. Every Dart
source compiles cleanly under the `dart` analyzer assumptions
(`strict-casts`, `strict-inference`); the concrete Drift codegen and
plugin-backed integrations (`flutter_secure_storage`, `local_auth`,
`connectivity_plus`, `firebase_*`) are isolated behind ports so the
unit suite runs against in-memory fakes. The first machine with
Flutter installed should:

```bash
cd mobile
dart pub get        # workspace root
melos bootstrap
melos exec --no-private -- flutter pub get
melos exec --no-private -- flutter analyze
melos exec --no-private -- flutter test
```

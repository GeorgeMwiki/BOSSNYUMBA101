# BOSSNYUMBA Mobile Workspace

Flutter + Melos monorepo for BOSSNYUMBA's native mobile apps. Mirrors the
architecture used in the LITFIN `litfin_mobile` workspace.

This directory is **SCAFFOLDING ONLY** — the Dart files declare the intended
package structure, abstract class signatures, and method contracts. The actual
implementations throw `UnimplementedError` and are filled in by subsequent
phases. Compilation is not expected to pass yet; the goal is to give every
downstream worker a clear, opinionated skeleton.

## Layout

```
mobile/
├── melos.yaml                                    # Workspace orchestration
├── pubspec.yaml                                  # Workspace root
├── packages/
│   ├── bossnyumba_core/                          # Shared core library
│   │   ├── pubspec.yaml
│   │   └── lib/
│   │       ├── bossnyumba_core.dart              # Barrel
│   │       ├── sync_engine.dart                  # Outbox + replay
│   │       ├── biometric_service.dart            # local_auth wrapper
│   │       ├── session_manager.dart              # JWT + tenant_id binding
│   │       ├── connectivity_monitor.dart         # Network reachability
│   │       ├── rbac.dart                         # Mobile role policy
│   │       ├── database/database.dart            # Drift / SQLCipher
│   │       └── geolocation/haversine.dart        # Nearest-unit math
│   └── bossnyumba_ui/                            # Shared design system
│       ├── pubspec.yaml
│       └── lib/
│           ├── bossnyumba_ui.dart                # Barrel
│           ├── theme.dart                        # Color + typography tokens
│           └── widgets/
│               ├── property_card.dart
│               └── payment_button.dart
└── apps/
    ├── estate_manager_mobile/                    # Field-ops app
    │   ├── pubspec.yaml
    │   └── lib/
    │       ├── main.dart
    │       └── screens/
    │           ├── inspection_screen.dart        # Photo capture + RAG fill
    │           └── tenant_signing_screen.dart    # Biometric lease sign-off
    └── customer_mobile/                          # Tenant-facing app
        ├── pubspec.yaml
        └── lib/
            ├── main.dart
            └── screens/
                └── pay_rent_screen.dart          # M-Pesa STK trigger
```

## App targets

| App                     | Audience                                            | Primary flows                                                                       |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `estate_manager_mobile` | Estate managers, building supervisors, inspectors   | Field inspections, photo capture, maintenance triage, biometric tenant sign-off.    |
| `customer_mobile`       | Tenant residents (and owner-advisors in v2)         | Rent payment via M-Pesa STK push, lease access, maintenance ticket creation.        |

## Melos commands

Run from the `mobile/` directory:

```bash
# Install workspace dependencies
melos bootstrap

# Lint
melos run analyze

# Format
melos run format            # write
melos run format:check      # CI / pre-commit

# Tests
melos run test
melos run test:coverage

# Code generation (Drift schema, Freezed models, Riverpod providers)
melos run build_runner

# Clean Flutter caches
melos run clean
```

## Implementation status

| Surface                             | Status      | Notes                                                                  |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `bossnyumba_core/sync_engine.dart`  | **stub**    | Abstract outbox + replay contract. BOSSNYUMBA-specific entities documented. |
| `bossnyumba_core/biometric_service` | **stub**    | Wraps `local_auth`. Mirrors LITFIN's enrollment-token-hash protocol.   |
| `bossnyumba_core/session_manager`   | **stub**    | JWT + refresh + `tenant_id` claim binding for multi-tenant routing.    |
| `bossnyumba_core/connectivity_monitor` | **stub** | Pings `/api/health` to confirm true reachability (TZ networks lie).    |
| `bossnyumba_core/database/database` | **stub**    | Drift schema with 6 cached entity tables + outbox.                     |
| `bossnyumba_core/geolocation/haversine` | **stub**| Distance math for nearest-unit / property-radius queries.              |
| `bossnyumba_core/rbac`              | **stub**    | Mirrors backend roles (TENANT_RESIDENT, OWNER_ADVISOR, ESTATE_MANAGER...). |
| `bossnyumba_ui/theme`               | **stub**    | Color tokens matching the web design-system package.                   |
| `bossnyumba_ui/widgets/*`           | **stub**    | Property card, payment button — visual contracts only.                 |
| `estate_manager_mobile`             | **stub**    | Inspection + tenant signing screens scaffolded.                        |
| `customer_mobile`                   | **stub**    | Pay-rent screen scaffolded with M-Pesa STK push hook.                  |

## Tenant context

Every mobile request must carry an active `tenant_id` (multi-tenant SaaS).
`SessionManager` is responsible for:

1. Storing the JWT (in `flutter_secure_storage`).
2. Extracting and binding `tenant_id` from the access token.
3. Injecting `tenant_id` into every outbound API call header.
4. Surfacing the active tenant to the UI for context-switching when a single
   account belongs to multiple properties or building blocks.

## Offline-first contract

Every mutation goes through `SyncEngine.queueMutation(...)` which persists to
the encrypted Drift outbox table. On reconnection (signalled by
`ConnectivityMonitor`), the engine replays queued mutations in FIFO order with
exponential backoff. Conflict policy: **server_wins_with_audit** — local
divergence is preserved in the audit log and the server's view takes effect.

## Entities cached locally

The shared `bossnyumba_core` package owns offline caches for six BOSSNYUMBA
entities — see `database/database.dart`:

1. `Property` — building / estate
2. `Unit` — individual rentable unit
3. `Lease` — agreement between tenant and unit
4. `Tenant` — resident profile
5. `Payment` — rent transactions
6. `MaintenanceTicket` — issues raised by tenants

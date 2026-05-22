# Workspace-level integration tests

Cross-cutting integration-test catalogue that runs against the shared
`bossnyumba_core` services without booting either app shell. The actual
test sources live in this directory's `test/` subdir; per-app
integration tests (login_flow, rent_payment_flow) are mirrored under
each app's `integration_test/` directory so `flutter test
integration_test/...` works from there.

## Run

```bash
# All workspace-level integration tests
cd mobile/integration_test
flutter test test/

# Single test file
flutter test test/sync_offline_to_online_test.dart

# Per-app integration suite
cd mobile/apps/estate_manager_mobile
flutter test integration_test/login_flow_test.dart

cd mobile/apps/customer_mobile
flutter test integration_test/rent_payment_flow_test.dart
```

## Tests

| File                                       | Flow                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `test/login_flow_test.dart`                | Full session bootstrap: storage -> startSession -> activity -> idle.        |
| `test/sync_offline_to_online_test.dart`    | Queue 3 mutations offline, regain link, drain payment-first priority order. |
| `test/biometric_enroll_test.dart`          | Capability -> enroll -> authenticate (deterministic in-memory service).     |
| `test/tenant_switch_test.dart`             | switchTenant rotates the access + refresh token and updates currentTenantId.|
| `test/rent_payment_flow_test.dart`         | Rent payment carries idempotency-key and drains successfully when online.   |

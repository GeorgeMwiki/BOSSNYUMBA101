// ---------------------------------------------------------------------------
// estate_manager_mobile / screens / tenant_signing_screen.dart
// ---------------------------------------------------------------------------
// Tenant lease sign-off screen (biometric).
//
// What BELONGS in this file:
//   * The `TenantSigningScreen` widget — used when a tenant signs a
//     new lease while the estate manager is on-site:
//       1. Manager opens the lease draft on their phone.
//       2. Screen shows the lease summary (rent, term, deposits).
//       3. Tenant taps "Sign" and is prompted for their biometric
//          via `BiometricService` (one-shot OS prompt with no
//          enrolment requirement — we capture the verification
//          result + device id as the signature evidence).
//       4. Signed lease is queued via SyncEngine (offline-safe).
//
// What does NOT belong here:
//   * PDF rendering of the signed lease — that's a server-side job.
//   * Legal disclaimers — pull from CMS / Strapi at runtime.
//
// Security note:
//   The biometric prompt here is an authorisation gesture, NOT an
//   identification one. The lease is bound to the tenant by their
//   account session (which they signed into on this device or via
//   the customer app). The biometric proves "the person holding
//   the device is willing to sign", which is what we need for
//   non-repudiation under PDPA / TZ Electronic Transactions Act.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

/// Biometric tenant lease sign-off (STUB).
///
/// Implementation pending. The completed widget will:
///   - Render lease summary cards.
///   - Show a "Sign with fingerprint" CTA.
///   - Call `BiometricService.prompt(reason: ...)`.
///   - On success, POST signature evidence + queue via SyncEngine.
class TenantSigningScreen extends StatelessWidget {
  const TenantSigningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    throw UnimplementedError(
      'TenantSigningScreen.build() — implementation pending. '
      'Will render lease summary + biometric sign CTA.',
    );
  }
}

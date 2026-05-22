// ---------------------------------------------------------------------------
// customer_mobile / screens / pay_rent_screen.dart
// ---------------------------------------------------------------------------
// Pay rent screen (M-Pesa STK push trigger).
//
// What BELONGS in this file:
//   * The `PayRentScreen` widget — tenant-facing primary CTA.
//     Workflow:
//       1. Show current outstanding balance + due date.
//       2. Tenant taps the M-Pesa `PaymentButton`.
//       3. App calls `/api/payments/mpesa/stk-push` with amount + phone.
//       4. STK push is shown on the tenant's SIM — they enter PIN.
//       5. Backend webhook reconciles; the screen polls the payment
//          status endpoint (or listens to push notification) and
//          flips to the success state.
//   * Loading / error / success state machine for the payment.
//
// What does NOT belong here:
//   * The Daraja API integration — server-side responsibility.
//   * Receipt PDF rendering — a follow-up screen.
//
// Multi-tenant + currency note:
//   The amount and currency MUST come from the lease's tenant
//   currency configuration (via `SessionManager.currentTenantId` →
//   tenant prefs API). DO NOT hard-code TZS in the button — pass
//   the tenant's display currency through.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

/// Tenant rent-pay screen (STUB).
///
/// Implementation pending. The completed widget will:
///   - Fetch outstanding balance from `/api/leases/{id}/balance`.
///   - Render `PaymentButton(method: PaymentMethod.mpesa, ...)`.
///   - Orchestrate the STK push → poll → confirm flow.
///   - Surface offline-banner if `ConnectivityMonitor.isOnline == false`.
class PayRentScreen extends StatelessWidget {
  const PayRentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    throw UnimplementedError(
      'PayRentScreen.build() — implementation pending. '
      'Will render balance + M-Pesa STK push CTA and poll for confirmation.',
    );
  }
}

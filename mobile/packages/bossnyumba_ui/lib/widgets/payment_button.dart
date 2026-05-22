// ---------------------------------------------------------------------------
// widgets/payment_button.dart
// ---------------------------------------------------------------------------
// `PaymentButton` — primary CTA for rent / fee payments.
//
// What BELONGS in this file:
//   * The `PaymentButton` widget — large, high-affordance CTA that
//     wraps a payment-method icon (M-Pesa / Tigo Pesa / Airtel Money /
//     bank card) and the amount.
//   * The `PaymentMethod` enum used by the button to pick its icon
//     and accent colour.
//   * Loading + disabled states.
//
// What does NOT belong here:
//   * Actual STK push / payment flow — that lives in the screen's
//     view-model / repository.
//   * Currency formatting beyond a simple `formatAmount` hook —
//     consider lifting that to a shared util later.
//
// Used by:
//   * `customer_mobile/screens/pay_rent_screen.dart`.
//   * Future: estate manager "record cash payment" flow.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

/// Mobile-money / card method the button represents.
enum PaymentMethod { mpesa, tigopesa, airtelmoney, bankCard, cash }

/// Primary payment CTA.
class PaymentButton extends StatelessWidget {
  /// Method this button invokes.
  final PaymentMethod method;

  /// Amount in minor units (TZS has no minor unit, so plain integers).
  final double amount;

  /// ISO 4217 currency code (default TZS — but never hard-code in
  /// business logic; pass the tenant's display currency through).
  final String currency;

  /// Tap handler — host screen orchestrates the STK push.
  final VoidCallback? onPressed;

  /// True while an outbound payment is in-flight.
  final bool isLoading;

  const PaymentButton({
    super.key,
    required this.method,
    required this.amount,
    required this.currency,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    throw UnimplementedError(
      'PaymentButton.build() — implementation pending. '
      'Will render a method-coloured CTA with icon + amount per BossnyumbaTheme.',
    );
  }
}

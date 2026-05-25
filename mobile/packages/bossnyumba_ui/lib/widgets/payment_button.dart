// ---------------------------------------------------------------------------
// widgets/payment_button.dart
// ---------------------------------------------------------------------------
// `PaymentButton` — primary CTA for rent / fee payments.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

import '../theme.dart';

/// Mobile-money / card method the button represents.
enum PaymentMethod { mpesa, tigopesa, airtelmoney, bankCard, cash }

/// Method-specific accent colour.
Color _accentFor(PaymentMethod method) {
  switch (method) {
    case PaymentMethod.mpesa:
      return const Color(0xFF00A859); // Safaricom green
    case PaymentMethod.tigopesa:
      return const Color(0xFF0066B3); // Tigo blue
    case PaymentMethod.airtelmoney:
      return const Color(0xFFE60028); // Airtel red
    case PaymentMethod.bankCard:
      return BossnyumbaColors.primary;
    case PaymentMethod.cash:
      return BossnyumbaColors.neutral600;
  }
}

String _labelFor(PaymentMethod method) {
  switch (method) {
    case PaymentMethod.mpesa:
      return 'Pay with M-Pesa';
    case PaymentMethod.tigopesa:
      return 'Pay with Tigo Pesa';
    case PaymentMethod.airtelmoney:
      return 'Pay with Airtel Money';
    case PaymentMethod.bankCard:
      return 'Pay with card';
    case PaymentMethod.cash:
      return 'Record cash payment';
  }
}

/// Primary payment CTA.
class PaymentButton extends StatelessWidget {
  const PaymentButton({
    super.key,
    required this.method,
    required this.amount,
    required this.currency,
    this.onPressed,
    this.isLoading = false,
  });

  final PaymentMethod method;
  final double amount;
  final String currency;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final accent = _accentFor(method);
    final label = _labelFor(method);
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: BossnyumbaColors.neutral0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    BossnyumbaColors.neutral0,
                  ),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Text(label, style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: 12),
                  Text(
                    '${amount.toStringAsFixed(0)} $currency',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

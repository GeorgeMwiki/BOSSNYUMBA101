// ---------------------------------------------------------------------------
// customer_mobile / screens / pay_rent_screen.dart
// ---------------------------------------------------------------------------
// Pay rent screen (M-Pesa STK push trigger) — minimal renderable shell.
//
// The complete implementation will:
//   - Fetch outstanding balance from `/api/leases/{id}/balance`.
//   - Render `PaymentButton(method: PaymentMethod.mpesa, ...)`.
//   - Orchestrate the STK push -> poll -> confirm flow.
//   - Surface offline-banner if `ConnectivityMonitor.isOnline == false`.
// ---------------------------------------------------------------------------

import 'package:bossnyumba_ui/bossnyumba_ui.dart';
import 'package:flutter/material.dart';

class PayRentScreen extends StatelessWidget {
  const PayRentScreen({
    super.key,
    this.outstandingAmount = 0,
    this.currency = 'TZS',
  });

  final double outstandingAmount;
  final String currency;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pay rent')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              'Outstanding balance',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(
              '${outstandingAmount.toStringAsFixed(0)} $currency',
              style: Theme.of(context).textTheme.displayLarge,
            ),
            const SizedBox(height: 24),
            PaymentButton(
              key: const Key('pay-rent-mpesa-cta'),
              method: PaymentMethod.mpesa,
              amount: outstandingAmount,
              currency: currency,
              onPressed: () {},
            ),
          ],
        ),
      ),
    );
  }
}

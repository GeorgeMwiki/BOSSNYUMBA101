// ---------------------------------------------------------------------------
// customer_mobile / main.dart
// ---------------------------------------------------------------------------
// Entry point for the Customer (tenant) mobile app.
// ---------------------------------------------------------------------------

import 'package:bossnyumba_ui/bossnyumba_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/pay_rent_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: CustomerApp()));
}

/// Root widget for the Customer (tenant) app.
class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BOSSNYUMBA',
      theme: BossnyumbaTheme.light(),
      darkTheme: BossnyumbaTheme.dark(),
      home: const _CustomerHome(),
    );
  }
}

class _CustomerHome extends StatelessWidget {
  const _CustomerHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('BOSSNYUMBA')),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Welcome home.'),
            SizedBox(height: 8),
            Text(
              'Pay rent, view your lease, raise a maintenance ticket.',
            ),
          ],
        ),
      ),
      floatingActionButton: Builder(
        builder: (ctx) => FloatingActionButton.extended(
          key: const Key('customer-pay-rent-fab'),
          onPressed: () => Navigator.of(ctx).push(
            MaterialPageRoute<void>(
              builder: (_) => const PayRentScreen(
                outstandingAmount: 250000,
                currency: 'TZS',
              ),
            ),
          ),
          label: const Text('Pay rent'),
          icon: const Icon(Icons.payments_outlined),
        ),
      ),
    );
  }
}

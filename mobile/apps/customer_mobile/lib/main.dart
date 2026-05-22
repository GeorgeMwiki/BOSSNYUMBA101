// ---------------------------------------------------------------------------
// customer_mobile / main.dart
// ---------------------------------------------------------------------------
// Entry point for the Customer (tenant) mobile app.
//
// What BELONGS in this file:
//   * `main()` — boot sequence, error capture, Riverpod `ProviderScope`.
//   * Phased startup matching `estate_manager_mobile`.
//   * Root `MaterialApp` bound to `BossnyumbaTheme` + `go_router`.
//
// What does NOT belong here:
//   * Screen widgets — those live under `lib/screens/`.
//   * Deep-link handling — extract once the link set stabilises.
//
// Cold-start target: < 2s on a low-tier device — many tenants are on
// budget Android handsets (Itel / Tecno Pop). Defer Firebase + sync
// engine warmup until after first frame.
// ---------------------------------------------------------------------------

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
    // Implementation pending — will wire BossnyumbaTheme + go_router.
    return const MaterialApp(
      title: 'BOSSNYUMBA',
      home: _PlaceholderHome(),
    );
  }
}

class _PlaceholderHome extends StatelessWidget {
  const _PlaceholderHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('BOSSNYUMBA (scaffold)')),
      body: ListView(
        children: const [
          ListTile(
            title: Text('PayRentScreen'),
            subtitle: Text('Stub — pending implementation'),
          ),
        ],
      ),
      floatingActionButton: Builder(
        builder: (ctx) => FloatingActionButton.extended(
          onPressed: () => Navigator.of(ctx).push(
            MaterialPageRoute<void>(
              builder: (_) => const PayRentScreen(),
            ),
          ),
          label: const Text('Open pay-rent stub'),
        ),
      ),
    );
  }
}

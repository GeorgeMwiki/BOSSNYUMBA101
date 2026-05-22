// ---------------------------------------------------------------------------
// estate_manager_mobile / main.dart
// ---------------------------------------------------------------------------
// Entry point for the Estate Manager mobile app.
//
// What BELONGS in this file:
//   * `main()` — boot sequence, error capture, Riverpod `ProviderScope`.
//   * Phase-based startup (parallel critical-path init, then deferred
//     background work) — mirrors LITFIN's officer_app boot pattern.
//   * The root `MaterialApp` widget bound to `BossnyumbaTheme` and
//     the `go_router` configuration.
//
// What does NOT belong here:
//   * Screen widgets — those live under `lib/screens/`.
//   * Routing tables — extract to `lib/router/router.dart` once the
//     screen list stabilises.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/inspection_screen.dart';
import 'screens/tenant_signing_screen.dart';

/// Estate Manager app entry point.
///
/// Cold-start target: < 2.5s on a mid-tier Android device (Tecno Spark).
/// Phase 1 (parallel): connectivity monitor, encrypted DB open, secure
/// storage probe.
/// Phase 2: session bootstrap (load cached JWT, verify tenant claim).
/// Phase 3: render shell immediately.
/// Phase 4 (background): push notifications, sync engine warmup,
/// device-attestation probe.
void main() {
  // Full implementation pending. For now this file exists to anchor
  // the app target so Melos can discover it.
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: EstateManagerApp()));
}

/// Root widget for the Estate Manager app.
class EstateManagerApp extends StatelessWidget {
  const EstateManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Implementation pending — will wire BossnyumbaTheme + go_router.
    return const MaterialApp(
      title: 'BOSSNYUMBA · Estate Manager',
      home: _PlaceholderHome(),
    );
  }
}

class _PlaceholderHome extends StatelessWidget {
  const _PlaceholderHome();

  @override
  Widget build(BuildContext context) {
    // Anchored to the scaffolded screens so the file is referenced —
    // production code will route via go_router instead.
    final screens = <Widget>[
      const InspectionScreen(),
      const TenantSigningScreen(),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Estate Manager (scaffold)')),
      body: ListView(
        children: [
          for (final s in screens)
            ListTile(
              title: Text(s.runtimeType.toString()),
              subtitle: const Text('Stub — pending implementation'),
            ),
        ],
      ),
    );
  }
}

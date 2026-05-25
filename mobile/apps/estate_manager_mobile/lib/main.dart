// ---------------------------------------------------------------------------
// estate_manager_mobile / main.dart
// ---------------------------------------------------------------------------
// Entry point for the Estate Manager mobile app.
// ---------------------------------------------------------------------------

import 'package:bossnyumba_ui/bossnyumba_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/inspection_screen.dart';
import 'screens/tenant_signing_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: EstateManagerApp()));
}

/// Root widget for the Estate Manager app.
class EstateManagerApp extends StatelessWidget {
  const EstateManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BOSSNYUMBA · Estate Manager',
      theme: BossnyumbaTheme.light(),
      darkTheme: BossnyumbaTheme.dark(),
      home: const _PlaceholderHome(),
    );
  }
}

class _PlaceholderHome extends StatelessWidget {
  const _PlaceholderHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Estate Manager (scaffold)')),
      body: ListView(
        children: <Widget>[
          ListTile(
            key: const Key('estate-tile-inspection'),
            leading: const Icon(Icons.assignment_outlined),
            title: const Text('Inspection'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const InspectionScreen(),
              ),
            ),
          ),
          ListTile(
            key: const Key('estate-tile-tenant-signing'),
            leading: const Icon(Icons.fingerprint),
            title: const Text('Sign lease'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const TenantSigningScreen(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

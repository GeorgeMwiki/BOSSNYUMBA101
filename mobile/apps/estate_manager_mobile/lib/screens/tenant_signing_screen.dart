// ---------------------------------------------------------------------------
// estate_manager_mobile / screens / tenant_signing_screen.dart
// ---------------------------------------------------------------------------
// Tenant lease sign-off screen (biometric) — minimal renderable shell.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

class TenantSigningScreen extends StatelessWidget {
  const TenantSigningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign lease')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              'Lease summary',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'Lease terms render here. The tenant taps "Sign with fingerprint" '
              'to authorise; the BiometricService prompt produces non-repudiation '
              'evidence which is queued offline-safe.',
            ),
            const Spacer(),
            FilledButton(
              key: const Key('tenant-sign-cta'),
              onPressed: () {},
              child: const Text('Sign with fingerprint'),
            ),
          ],
        ),
      ),
    );
  }
}

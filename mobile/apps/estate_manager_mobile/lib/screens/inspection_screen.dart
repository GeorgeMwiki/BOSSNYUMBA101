// ---------------------------------------------------------------------------
// estate_manager_mobile / screens / inspection_screen.dart
// ---------------------------------------------------------------------------
// Property inspection screen — minimal renderable shell.
//
// The complete implementation will lay out:
//   * GPS check-in banner (success / out-of-range / no-signal).
//   * Photo grid with capture FAB.
//   * "AI fill" button that hits `/api/inspections/draft`.
//   * Editable inspection form (rooms, conditions, severity chips).
//   * Save (offline-safe via SyncEngine.queueMutation).
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

class InspectionScreen extends StatelessWidget {
  const InspectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inspection')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.camera_alt_outlined, size: 64),
              const SizedBox(height: 12),
              Text(
                'Inspection workflow',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              const Text(
                'Photos, GPS check-in, RAG-assisted form fill. '
                'Full UI lands in a follow-up phase.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(
                key: const Key('inspection-capture-photo'),
                onPressed: () {},
                child: const Text('Capture photo'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

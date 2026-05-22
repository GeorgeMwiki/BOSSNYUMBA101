// ---------------------------------------------------------------------------
// estate_manager_mobile / screens / inspection_screen.dart
// ---------------------------------------------------------------------------
// Property inspection screen.
//
// What BELONGS in this file:
//   * The `InspectionScreen` widget — the field-ops screen estate
//     managers and supervisors use on-site to:
//       1. Capture photos of unit conditions (`image_picker` /
//          `camera`).
//       2. Trigger the RAG-assisted form fill: photos + audio dictation
//          are sent to the backend AI which returns a partially
//          populated inspection report; manager confirms.
//       3. Drop a GPS pin to confirm on-site presence.
//       4. Save offline — the sync engine queues the inspection until
//          reconnection.
//   * The view-model wiring (Riverpod) bridging the screen to
//     `bossnyumba_core` services (sync engine, connectivity monitor).
//
// What does NOT belong here:
//   * Camera plugin glue — extract into `lib/services/` once the
//     real implementation lands.
//   * AI request transport — lives in the API client.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';

/// Property inspection screen (STUB).
///
/// Implementation pending. The completed widget will lay out:
///   - GPS check-in banner (success / out-of-range / no-signal).
///   - Photo grid with capture FAB.
///   - "AI fill" button that hits `/api/inspections/draft`.
///   - Editable inspection form (rooms, conditions, severity chips).
///   - Save (offline-safe via SyncEngine.queueMutation).
class InspectionScreen extends StatelessWidget {
  const InspectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    throw UnimplementedError(
      'InspectionScreen.build() — implementation pending. '
      'Will render photo grid + GPS banner + RAG form fill.',
    );
  }
}

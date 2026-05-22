// ---------------------------------------------------------------------------
// connectivity_monitor.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA network reachability monitor.
//
// What BELONGS in this file:
//   * Abstract `ConnectivityMonitor` contract.
//   * Reachability check that goes BEYOND simple WiFi / cellular signal
//     detection. In Tanzania (and many emerging markets) a cellular bar
//     does not mean the device can talk to our API. Implementations MUST
//     perform a HEAD request to `${apiBaseUrl}/api/health` before
//     declaring the device online.
//
// What does NOT belong here:
//   * Sync replay logic — that lives in `sync_engine.dart` and listens
//     to this monitor's stream.
//   * UI banners — they subscribe to `onConnectivityChanged` from the
//     UI layer.
// ---------------------------------------------------------------------------

import 'dart:async';

/// Abstract connectivity monitor.
///
/// Concrete implementation wraps `package:connectivity_plus` for the
/// link-layer signal AND issues a HEAD `${apiBaseUrl}/api/health`
/// before declaring true reachability.
abstract class ConnectivityMonitor {
  /// Current reachability: device can actually reach the API.
  bool get isOnline;

  /// Stream of reachability changes.
  Stream<bool> get onConnectivityChanged;

  /// Begin monitoring. Idempotent.
  Future<void> initialize() {
    throw UnimplementedError(
      'initialize() must be implemented by ConnectivityMonitor subclasses',
    );
  }

  /// Force an immediate reachability check.
  ///
  /// Useful right before the sync engine attempts a replay so it can
  /// avoid wasting battery on a known-dead network.
  Future<bool> checkNow() {
    throw UnimplementedError(
      'checkNow() must be implemented by ConnectivityMonitor subclasses',
    );
  }

  /// Release platform subscriptions.
  void dispose() {
    throw UnimplementedError(
      'dispose() must be implemented by ConnectivityMonitor subclasses',
    );
  }
}

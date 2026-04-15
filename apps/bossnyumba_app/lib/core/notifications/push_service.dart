import 'package:flutter/foundation.dart';

/// Thin wrapper around a push-notifications backend. Concrete FCM/APNs
/// plumbing can be added later — for now [initialize] is idempotent and
/// registers the user with the server once they are authenticated.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _initialized = false;
  bool get isInitialized => _initialized;

  /// Called AFTER the user authenticates. Safe to call repeatedly — only
  /// the first invocation performs real work.
  Future<void> initialize({String? userId}) async {
    if (_initialized) return;
    _initialized = true;
    // TODO: request push permissions, obtain device token, register with API.
    if (kDebugMode) {
      debugPrint('[PushService] initialize (userId=$userId)');
    }
  }

  /// Tear down state on logout so a subsequent [initialize] re-registers.
  Future<void> reset() async {
    _initialized = false;
  }
}

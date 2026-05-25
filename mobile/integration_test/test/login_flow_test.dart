// ---------------------------------------------------------------------------
// integration_test/login_flow_test.dart
// ---------------------------------------------------------------------------
// End-to-end login flow for the estate_manager_mobile app.
//
// The full Flutter integration_test invocation lives at
// `mobile/apps/estate_manager_mobile/integration_test/login_flow_test.dart`
// (mirrored from this file). Both files share the same test body to keep
// the cross-cutting "workspace integration catalogue" honest.
// ---------------------------------------------------------------------------

import 'package:bossnyumba_core/session_manager.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('login flow: storage -> startSession -> activity -> idle',
      (tester) async {
    final storage = InMemorySessionStorage();
    final clock = _MutableClock(DateTime(2026, 5, 22, 9));
    final refresh = _NullRefreshClient();
    final mgr = DefaultSessionManager(
      storage: storage,
      refreshClient: refresh,
      clock: clock,
    );
    final t0 = clock.now();
    final session = Session(
      userId: 'manager-1',
      tenantId: 'estate-1',
      role: 'ESTATE_MANAGER',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: t0.add(const Duration(minutes: 15)),
      absoluteExpiresAt: t0.add(const Duration(hours: 24)),
    );
    await mgr.startSession(session);

    expect(mgr.currentSession, isNotNull);
    expect(mgr.currentTenantId, 'estate-1');
    expect(mgr.currentState, SessionState.active);
    expect(storage.snapshot(), isNotEmpty);

    // User active for 14 minutes -> still active.
    clock.advance(const Duration(minutes: 14));
    mgr.recordActivity();
    expect(mgr.currentState, SessionState.active);

    // No activity for 16 minutes -> idle.
    clock.advance(const Duration(minutes: 16));
    final next = mgr.evaluateTimeouts();
    expect(next, SessionState.idle);
    mgr.dispose();
  });
}

class _MutableClock implements Clock {
  _MutableClock(this._now);
  DateTime _now;
  @override
  DateTime now() => _now;
  void advance(Duration d) => _now = _now.add(d);
}

class _NullRefreshClient implements RefreshClient {
  @override
  Future<Session> refresh({
    required String refreshToken,
    String? targetTenantId,
  }) async {
    throw const InvalidTokenException('not used in this flow');
  }
}

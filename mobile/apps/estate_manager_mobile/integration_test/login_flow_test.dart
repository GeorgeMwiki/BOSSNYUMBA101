// Mirror of `mobile/integration_test/login_flow_test.dart`.
// Per-app location is required by `flutter test integration_test/...`.

import 'package:bossnyumba_core/session_manager.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('login flow: storage -> startSession -> activity -> idle',
      (tester) async {
    final storage = InMemorySessionStorage();
    final clock = _MutableClock(DateTime(2026, 5, 22, 9));
    final mgr = DefaultSessionManager(
      storage: storage,
      refreshClient: _NullRefreshClient(),
      clock: clock,
    );
    final t0 = clock.now();
    await mgr.startSession(Session(
      userId: 'manager-1',
      tenantId: 'estate-1',
      role: 'ESTATE_MANAGER',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: t0.add(const Duration(minutes: 15)),
      absoluteExpiresAt: t0.add(const Duration(hours: 24)),
    ));
    expect(mgr.currentTenantId, 'estate-1');
    expect(mgr.currentState, SessionState.active);

    clock.advance(const Duration(minutes: 14));
    mgr.recordActivity();
    expect(mgr.currentState, SessionState.active);

    clock.advance(const Duration(minutes: 16));
    expect(mgr.evaluateTimeouts(), SessionState.idle);
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

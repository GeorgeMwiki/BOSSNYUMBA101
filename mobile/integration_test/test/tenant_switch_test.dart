// ---------------------------------------------------------------------------
// integration_test/tenant_switch_test.dart
// ---------------------------------------------------------------------------
// Multi-tenant: user belongs to t-1 and t-2, switches between them.
// ---------------------------------------------------------------------------

import 'package:bossnyumba_core/session_manager.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('switchTenant rotates token and updates currentTenantId',
      (tester) async {
    final storage = InMemorySessionStorage();
    final clock = _Clock(DateTime(2026, 5, 22, 9));
    final refresh = _TenantBindingRefresh();
    final mgr = DefaultSessionManager(
      storage: storage,
      refreshClient: refresh,
      clock: clock,
    );
    final t0 = clock.now();
    await mgr.startSession(Session(
      userId: 'owner-1',
      tenantId: 't-1',
      role: 'OWNER_ADVISOR',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: t0.add(const Duration(minutes: 15)),
      absoluteExpiresAt: t0.add(const Duration(hours: 24)),
    ));

    expect(mgr.currentTenantId, 't-1');
    final next = await mgr.switchTenant('t-2');
    expect(next.tenantId, 't-2');
    expect(mgr.currentTenantId, 't-2');
    // Rotation invariant: refresh token has changed.
    expect(next.refreshToken, isNot('refresh-1'));

    mgr.dispose();
  });
}

class _Clock implements Clock {
  _Clock(this._now);
  DateTime _now;
  @override
  DateTime now() => _now;
}

class _TenantBindingRefresh implements RefreshClient {
  int _rotation = 1;
  @override
  Future<Session> refresh({
    required String refreshToken,
    String? targetTenantId,
  }) async {
    _rotation += 1;
    final now = DateTime(2026, 5, 22, 9);
    return Session(
      userId: 'owner-1',
      tenantId: targetTenantId ?? 't-1',
      role: 'OWNER_ADVISOR',
      accessToken: 'access-$_rotation',
      refreshToken: 'refresh-$_rotation',
      accessTokenExpiresAt: now.add(const Duration(minutes: 15)),
      absoluteExpiresAt: now.add(const Duration(hours: 24)),
    );
  }
}

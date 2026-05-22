// ---------------------------------------------------------------------------
// session_manager_test.dart
// ---------------------------------------------------------------------------
// Unit tests for `DefaultSessionManager`.
//
// Covers:
//   1. login persists session
//   2. logout clears state + emits expired
//   3. access-token expiry triggers refresh via injected RefreshClient
//   4. refresh enforces token rotation (server MUST return new refresh tok)
//   5. invalid refresh -> session expired + tokenInvalid event
//   6. idle timeout -> idle state + SessionExpiredReason.idle event
//   7. activity resets idle timer
//   8. absolute timeout fires after 24h regardless of activity
//   9. switchTenant rotates token bound to new tenant_id
//  10. switchTenant rejected -> tenantSwitchRequired event
//  11. persistence survives restart (restore() reads back)
//  12. restoring expired session emits absolute + clears storage
// ---------------------------------------------------------------------------

import 'package:bossnyumba_core/session_manager.dart';
import 'package:flutter_test/flutter_test.dart';

class _MockClock implements Clock {
  _MockClock(this._now);
  DateTime _now;
  @override
  DateTime now() => _now;
  void advance(Duration d) => _now = _now.add(d);
  void setTo(DateTime t) => _now = t;
}

class _FakeRefreshClient implements RefreshClient {
  _FakeRefreshClient({
    required this.next,
    this.shouldThrow = false,
    this.respectTarget = true,
  });

  Session next;
  bool shouldThrow;
  bool respectTarget;
  String? lastTargetTenantId;
  int calls = 0;

  @override
  Future<Session> refresh({
    required String refreshToken,
    String? targetTenantId,
  }) async {
    calls += 1;
    lastTargetTenantId = targetTenantId;
    if (shouldThrow) {
      throw const InvalidTokenException('rejected');
    }
    if (targetTenantId != null && respectTarget) {
      return next.copyWith(tenantId: targetTenantId);
    }
    return next;
  }
}

Session _session({
  String userId = 'user-1',
  String tenantId = 't-1',
  String role = 'TENANT_RESIDENT',
  String accessToken = 'access-1',
  String refreshToken = 'refresh-1',
  DateTime? accessExp,
  DateTime? absoluteExp,
}) {
  final now = DateTime(2026, 5, 22, 9);
  return Session(
    userId: userId,
    tenantId: tenantId,
    role: role,
    accessToken: accessToken,
    refreshToken: refreshToken,
    accessTokenExpiresAt: accessExp ?? now.add(const Duration(minutes: 15)),
    absoluteExpiresAt: absoluteExp ?? now.add(const Duration(hours: 24)),
  );
}

void main() {
  group('DefaultSessionManager', () {
    late InMemorySessionStorage storage;
    late _MockClock clock;
    late _FakeRefreshClient refresh;
    late DefaultSessionManager mgr;

    final t0 = DateTime(2026, 5, 22, 9);

    setUp(() {
      storage = InMemorySessionStorage();
      clock = _MockClock(t0);
      refresh = _FakeRefreshClient(
        next: _session(
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          accessExp: t0.add(const Duration(minutes: 15)),
          absoluteExp: t0.add(const Duration(hours: 24)),
        ),
      );
      mgr = DefaultSessionManager(
        storage: storage,
        refreshClient: refresh,
        clock: clock,
      );
    });

    tearDown(() => mgr.dispose());

    test('startSession persists and emits active', () async {
      final events = <SessionState>[];
      final sub = mgr.onSessionStateChanged.listen(events.add);
      await mgr.startSession(_session());
      await Future<void>.delayed(Duration.zero);
      expect(mgr.currentSession, isNotNull);
      expect(mgr.currentTenantId, 't-1');
      expect(mgr.currentState, SessionState.active);
      expect(storage.snapshot(), isNotEmpty);
      expect(events, contains(SessionState.active));
      await sub.cancel();
    });

    test('endSession clears state and emits manual reason', () async {
      await mgr.startSession(_session());
      final reasons = <SessionExpiredReason>[];
      final sub = mgr.onSessionExpired.listen(reasons.add);
      await mgr.endSession();
      await Future<void>.delayed(Duration.zero);
      expect(mgr.currentSession, isNull);
      expect(mgr.currentState, SessionState.expired);
      expect(storage.snapshot(), isEmpty);
      expect(reasons, contains(SessionExpiredReason.manual));
      await sub.cancel();
    });

    test('needsRefresh true once we hit the buffer window', () async {
      await mgr.startSession(_session(
        accessExp: t0.add(const Duration(minutes: 15)),
      ));
      expect(mgr.needsRefresh, isFalse);
      clock.advance(const Duration(minutes: 14));
      expect(mgr.needsRefresh, isTrue);
    });

    test('refresh enforces rotation: same refresh token -> tokenInvalid',
        () async {
      await mgr.startSession(_session(refreshToken: 'refresh-1'));
      refresh.next = _session(
        refreshToken: 'refresh-1', // same — must be rejected
        accessToken: 'access-2',
      );
      final reasons = <SessionExpiredReason>[];
      mgr.onSessionExpired.listen(reasons.add);
      await expectLater(mgr.refresh(), throwsA(isA<InvalidTokenException>()));
      await Future<void>.delayed(Duration.zero);
      expect(reasons, contains(SessionExpiredReason.tokenInvalid));
      expect(mgr.currentSession, isNull);
    });

    test('successful refresh rotates token and preserves absolute ceiling',
        () async {
      final start = _session(absoluteExp: t0.add(const Duration(hours: 24)));
      await mgr.startSession(start);
      refresh.next = _session(
        refreshToken: 'refresh-2',
        accessToken: 'access-2',
        absoluteExp: t0.add(const Duration(hours: 999)), // server lies
      );
      final next = await mgr.refresh();
      expect(next.refreshToken, 'refresh-2');
      expect(next.accessToken, 'access-2');
      expect(next.absoluteExpiresAt, start.absoluteExpiresAt);
    });

    test('refresh failure on invalid token expires session', () async {
      await mgr.startSession(_session());
      refresh.shouldThrow = true;
      final reasons = <SessionExpiredReason>[];
      mgr.onSessionExpired.listen(reasons.add);
      await expectLater(mgr.refresh(), throwsA(isA<InvalidTokenException>()));
      await Future<void>.delayed(Duration.zero);
      expect(reasons, contains(SessionExpiredReason.tokenInvalid));
    });

    test('idle timeout fires after 15 min of inactivity', () async {
      await mgr.startSession(_session());
      final reasons = <SessionExpiredReason>[];
      mgr.onSessionExpired.listen(reasons.add);
      clock.advance(const Duration(minutes: 16));
      final state = mgr.evaluateTimeouts();
      await Future<void>.delayed(Duration.zero);
      expect(state, SessionState.idle);
      expect(reasons, contains(SessionExpiredReason.idle));
    });

    test('recordActivity resets idle timer', () async {
      await mgr.startSession(_session());
      clock.advance(const Duration(minutes: 14));
      mgr.recordActivity();
      clock.advance(const Duration(minutes: 14));
      final state = mgr.evaluateTimeouts();
      expect(state, SessionState.active);
    });

    test('absolute timeout terminates session regardless of activity',
        () async {
      await mgr.startSession(_session());
      // bounce activity every minute to keep idle alive ...
      for (var i = 0; i < 24 * 60; i++) {
        clock.advance(const Duration(minutes: 1));
        mgr.recordActivity();
      }
      // ... but absolute ceiling kicks in.
      final reasons = <SessionExpiredReason>[];
      mgr.onSessionExpired.listen(reasons.add);
      clock.advance(const Duration(minutes: 1));
      final state = mgr.evaluateTimeouts();
      await Future<void>.delayed(Duration.zero);
      expect(state, SessionState.expired);
      expect(reasons, contains(SessionExpiredReason.absolute));
    });

    test('switchTenant rotates token bound to new tenant_id', () async {
      await mgr.startSession(_session(tenantId: 't-1'));
      refresh.next = _session(
        refreshToken: 'refresh-2',
        accessToken: 'access-2',
        tenantId: 't-2',
      );
      final next = await mgr.switchTenant('t-2');
      expect(next.tenantId, 't-2');
      expect(mgr.currentTenantId, 't-2');
      expect(refresh.lastTargetTenantId, 't-2');
    });

    test(
        'switchTenant rejected when server cannot bind '
        '-> tenantSwitchRequired', () async {
      await mgr.startSession(_session(tenantId: 't-1'));
      refresh
        ..respectTarget = false
        ..next = _session(refreshToken: 'refresh-2', tenantId: 't-1');
      final reasons = <SessionExpiredReason>[];
      mgr.onSessionExpired.listen(reasons.add);
      await expectLater(
        mgr.switchTenant('t-2'),
        throwsA(isA<InvalidTokenException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(reasons, contains(SessionExpiredReason.tenantSwitchRequired));
    });

    test('restore reads back persisted session after restart', () async {
      await mgr.startSession(_session(userId: 'user-1', tenantId: 't-1'));
      // Simulate app restart: NEW manager pointing at the same storage.
      mgr.dispose();
      final mgr2 = DefaultSessionManager(
        storage: storage,
        refreshClient: refresh,
        clock: clock,
      );
      await mgr2.restore();
      expect(mgr2.currentSession, isNotNull);
      expect(mgr2.currentSession!.userId, 'user-1');
      expect(mgr2.currentTenantId, 't-1');
      expect(mgr2.currentState, SessionState.active);
      mgr2.dispose();
    });

    test('restore of expired session emits absolute + wipes storage',
        () async {
      await mgr.startSession(_session());
      clock.advance(const Duration(hours: 25));
      mgr.dispose();
      final mgr2 = DefaultSessionManager(
        storage: storage,
        refreshClient: refresh,
        clock: clock,
      );
      final reasons = <SessionExpiredReason>[];
      mgr2.onSessionExpired.listen(reasons.add);
      await mgr2.restore();
      await Future<void>.delayed(Duration.zero);
      expect(mgr2.currentSession, isNull);
      expect(reasons, contains(SessionExpiredReason.absolute));
      expect(storage.snapshot(), isEmpty);
      mgr2.dispose();
    });

    test('restore with garbage payload wipes storage + emits tokenInvalid',
        () async {
      await storage.write('bossnyumba.session.v1', '{not-json');
      final reasons = <SessionExpiredReason>[];
      mgr.onSessionExpired.listen(reasons.add);
      await mgr.restore();
      await Future<void>.delayed(Duration.zero);
      expect(mgr.currentSession, isNull);
      expect(reasons, contains(SessionExpiredReason.tokenInvalid));
      expect(storage.snapshot(), isEmpty);
    });
  });
}

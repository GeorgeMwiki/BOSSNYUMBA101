// ---------------------------------------------------------------------------
// session_manager.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA session lifecycle manager.
//
// What BELONGS in this file:
//   * `SessionManager` abstract contract.
//   * `Session` value object containing user id, tenant id, role, expiry.
//   * `SessionExpiredReason` enum so the router can route the user
//     correctly (idle -> soft re-auth, absolute -> full re-login,
//     `tenantSwitchRequired` -> tenant picker screen).
//   * `DefaultSessionManager` concrete implementation parameterised on
//     storage, clock, and http "ports" so tests can substitute fakes
//     without needing a Flutter runtime.
//
// What does NOT belong here:
//   * Login UI - that lives in the app target.
//   * The transport implementation for refresh-token HTTP - the
//     `RefreshClient` port is injected.
//
// Multi-tenant binding (CRITICAL):
//   Every BOSSNYUMBA API request must carry the active `tenant_id`.
//   The JWT issued by the backend has a `tenant_id` claim; this manager
//   parses it on login and exposes `currentTenantId` so the Dio
//   interceptor can attach it as the `x-tenant-id` header.
//   If a user belongs to multiple tenants, [switchTenant] re-issues
//   the token bound to a different tenant.
// ---------------------------------------------------------------------------

import 'dart:async';
import 'dart:convert';

import 'package:meta/meta.dart';

/// Authenticated session snapshot.
@immutable
class Session {
  const Session({
    required this.userId,
    required this.tenantId,
    required this.role,
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.absoluteExpiresAt,
  });

  final String userId;
  final String tenantId;

  /// Mirrors backend role (`TENANT_RESIDENT`, `ESTATE_MANAGER`, ...).
  final String role;
  final String accessToken;
  final String refreshToken;

  /// When the access token expires (from `exp` claim).
  final DateTime accessTokenExpiresAt;

  /// Absolute session ceiling — after this point, even a refresh
  /// is rejected and the user must full-login again. Defaults to
  /// login-time + 24 hours.
  final DateTime absoluteExpiresAt;

  Session copyWith({
    String? userId,
    String? tenantId,
    String? role,
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? absoluteExpiresAt,
  }) {
    return Session(
      userId: userId ?? this.userId,
      tenantId: tenantId ?? this.tenantId,
      role: role ?? this.role,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt ?? this.accessTokenExpiresAt,
      absoluteExpiresAt: absoluteExpiresAt ?? this.absoluteExpiresAt,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'userId': userId,
        'tenantId': tenantId,
        'role': role,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'accessTokenExpiresAt': accessTokenExpiresAt.toIso8601String(),
        'absoluteExpiresAt': absoluteExpiresAt.toIso8601String(),
      };

  static Session fromJson(Map<String, dynamic> json) {
    return Session(
      userId: json['userId'] as String,
      tenantId: json['tenantId'] as String,
      role: json['role'] as String,
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      accessTokenExpiresAt:
          DateTime.parse(json['accessTokenExpiresAt'] as String),
      absoluteExpiresAt: DateTime.parse(json['absoluteExpiresAt'] as String),
    );
  }
}

/// Why a session was terminated.
enum SessionExpiredReason {
  idle,
  absolute,
  tokenInvalid,
  manual,
  tenantSwitchRequired,
}

/// High-level session state for the router to listen to.
enum SessionState { active, idle, expired }

/// Storage port (so the concrete manager can depend on
/// `flutter_secure_storage` without coupling to it for tests).
abstract class SessionStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Refresh-token client port. Production wires this to the Dio-backed
/// auth repository; tests substitute a fake.
abstract class RefreshClient {
  /// Exchange a refresh token for a new session.
  ///
  /// Throws [InvalidTokenException] when the refresh token is no longer
  /// valid (rotated, revoked, expired, or tampered).
  Future<Session> refresh({
    required String refreshToken,
    String? targetTenantId,
  });
}

/// Thrown when the refresh token cannot be used to obtain a new session.
class InvalidTokenException implements Exception {
  const InvalidTokenException(this.message);
  final String message;

  @override
  String toString() => 'InvalidTokenException: $message';
}

/// Clock port — overridable for deterministic tests.
abstract class Clock {
  DateTime now();
}

/// Default wall-clock implementation.
class SystemClock implements Clock {
  const SystemClock();
  @override
  DateTime now() => DateTime.now();
}

/// Abstract session-manager contract.
abstract class SessionManager {
  Session? get currentSession;

  /// Active tenant id (shorthand for `currentSession?.tenantId`).
  ///
  /// The Dio interceptor reads this on every request to inject the
  /// `x-tenant-id` header — DO NOT bypass it.
  String? get currentTenantId;

  SessionState get currentState;

  Stream<SessionState> get onSessionStateChanged;
  Stream<SessionExpiredReason> get onSessionExpired;

  Future<void> startSession(Session session);
  void recordActivity();
  Future<Session> refresh();
  Future<Session> switchTenant(String tenantId);
  Future<void> endSession({SessionExpiredReason reason = SessionExpiredReason.manual});
  Future<void> restore();
  void dispose();
}

/// Default session manager.
///
/// * Persists session to [SessionStorage] (production -> `flutter_secure_storage`).
/// * Tracks idle timeout (15 min) + absolute timeout (24 h).
/// * Refreshes the access token using [RefreshClient] before expiry.
/// * Exposes `Stream<SessionState>` for the router.
/// * Switches tenants without forcing a full re-login.
class DefaultSessionManager implements SessionManager {
  DefaultSessionManager({
    required SessionStorage storage,
    required RefreshClient refreshClient,
    Clock clock = const SystemClock(),
    Duration idleTimeout = const Duration(minutes: 15),
    Duration absoluteTimeout = const Duration(hours: 24),
    Duration refreshBuffer = const Duration(minutes: 2),
    String storageKey = 'bossnyumba.session.v1',
  })  : _storage = storage,
        _refreshClient = refreshClient,
        _clock = clock,
        _idleTimeout = idleTimeout,
        _absoluteTimeout = absoluteTimeout,
        _refreshBuffer = refreshBuffer,
        _storageKey = storageKey;

  final SessionStorage _storage;
  final RefreshClient _refreshClient;
  final Clock _clock;
  final Duration _idleTimeout;
  final Duration _absoluteTimeout;
  final Duration _refreshBuffer;
  final String _storageKey;

  final StreamController<SessionState> _stateController =
      StreamController<SessionState>.broadcast();
  final StreamController<SessionExpiredReason> _expiredController =
      StreamController<SessionExpiredReason>.broadcast();

  Session? _session;
  SessionState _state = SessionState.expired;
  DateTime? _lastActivityAt;
  bool _disposed = false;

  @override
  Session? get currentSession => _session;

  @override
  String? get currentTenantId => _session?.tenantId;

  @override
  SessionState get currentState => _state;

  @override
  Stream<SessionState> get onSessionStateChanged => _stateController.stream;

  @override
  Stream<SessionExpiredReason> get onSessionExpired => _expiredController.stream;

  @override
  Future<void> startSession(Session session) async {
    _ensureNotDisposed();
    if (session.absoluteExpiresAt.isBefore(_clock.now())) {
      throw const InvalidTokenException('absolute expiry already past');
    }
    _session = session;
    _lastActivityAt = _clock.now();
    await _persist(session);
    _transition(SessionState.active);
  }

  @override
  void recordActivity() {
    if (_disposed || _session == null) return;
    final now = _clock.now();
    if (now.isAfter(_session!.absoluteExpiresAt)) {
      _expire(SessionExpiredReason.absolute);
      return;
    }
    _lastActivityAt = now;
    if (_state == SessionState.idle) {
      _transition(SessionState.active);
    }
  }

  /// Evaluate idle / absolute timeouts based on the wall clock.
  ///
  /// The router should call this on app resume / route change, OR a
  /// `Timer.periodic` should poke it every minute. Returns the new
  /// state so callers can react synchronously.
  SessionState evaluateTimeouts() {
    if (_disposed || _session == null) return _state;
    final now = _clock.now();
    if (now.isAfter(_session!.absoluteExpiresAt)) {
      _expire(SessionExpiredReason.absolute);
      return _state;
    }
    final last = _lastActivityAt ?? now;
    final idleFor = now.difference(last);
    if (idleFor >= _idleTimeout) {
      if (_state != SessionState.idle) {
        _transition(SessionState.idle);
        _expiredController.add(SessionExpiredReason.idle);
      }
    }
    return _state;
  }

  /// Whether the access token needs refresh (within [_refreshBuffer]
  /// of expiry). The Dio interceptor calls this before each request.
  bool get needsRefresh {
    final s = _session;
    if (s == null) return false;
    final now = _clock.now();
    return s.accessTokenExpiresAt.subtract(_refreshBuffer).isBefore(now);
  }

  @override
  Future<Session> refresh() async {
    _ensureNotDisposed();
    final s = _session;
    if (s == null) {
      throw const InvalidTokenException('no active session');
    }
    if (_clock.now().isAfter(s.absoluteExpiresAt)) {
      _expire(SessionExpiredReason.absolute);
      throw const InvalidTokenException('absolute expiry exceeded');
    }
    try {
      final rotated = await _refreshClient.refresh(refreshToken: s.refreshToken);
      // Rotation MUST happen — server returns a NEW refresh token.
      if (rotated.refreshToken == s.refreshToken) {
        throw const InvalidTokenException(
          'refresh token rotation required by server policy',
        );
      }
      // Preserve the original absolute ceiling across rotations.
      final preservedAbsolute = s.absoluteExpiresAt;
      final next = rotated.copyWith(absoluteExpiresAt: preservedAbsolute);
      _session = next;
      _lastActivityAt = _clock.now();
      await _persist(next);
      _transition(SessionState.active);
      return next;
    } on InvalidTokenException {
      _expire(SessionExpiredReason.tokenInvalid);
      rethrow;
    }
  }

  @override
  Future<Session> switchTenant(String tenantId) async {
    _ensureNotDisposed();
    final s = _session;
    if (s == null) {
      throw const InvalidTokenException('no active session');
    }
    if (s.tenantId == tenantId) {
      return s;
    }
    try {
      final rotated = await _refreshClient.refresh(
        refreshToken: s.refreshToken,
        targetTenantId: tenantId,
      );
      if (rotated.tenantId != tenantId) {
        // Server rejected the tenant switch — surface to the router via
        // the InvalidTokenException catch block below.
        throw InvalidTokenException(
          'server did not bind requested tenant $tenantId',
        );
      }
      final preservedAbsolute = s.absoluteExpiresAt;
      final next = rotated.copyWith(absoluteExpiresAt: preservedAbsolute);
      _session = next;
      _lastActivityAt = _clock.now();
      await _persist(next);
      _transition(SessionState.active);
      return next;
    } on InvalidTokenException {
      _expiredController.add(SessionExpiredReason.tenantSwitchRequired);
      rethrow;
    }
  }

  @override
  Future<void> endSession({
    SessionExpiredReason reason = SessionExpiredReason.manual,
  }) async {
    if (_disposed) return;
    _session = null;
    _lastActivityAt = null;
    await _storage.delete(_storageKey);
    _transition(SessionState.expired);
    _expiredController.add(reason);
  }

  @override
  Future<void> restore() async {
    _ensureNotDisposed();
    final raw = await _storage.read(_storageKey);
    if (raw == null) {
      _transition(SessionState.expired);
      return;
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('persisted session is not an object');
      }
      final s = Session.fromJson(decoded);
      if (_clock.now().isAfter(s.absoluteExpiresAt)) {
        await _storage.delete(_storageKey);
        _transition(SessionState.expired);
        _expiredController.add(SessionExpiredReason.absolute);
        return;
      }
      _session = s;
      _lastActivityAt = _clock.now();
      _transition(SessionState.active);
    } on FormatException catch (_) {
      await _storage.delete(_storageKey);
      _transition(SessionState.expired);
      _expiredController.add(SessionExpiredReason.tokenInvalid);
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _stateController.close();
    _expiredController.close();
  }

  // ── internal ───────────────────────────────────────────────────────────

  void _transition(SessionState next) {
    if (_state == next) return;
    _state = next;
    if (!_stateController.isClosed) {
      _stateController.add(next);
    }
  }

  void _expire(SessionExpiredReason reason) {
    _session = null;
    _lastActivityAt = null;
    _transition(SessionState.expired);
    if (!_expiredController.isClosed) {
      _expiredController.add(reason);
    }
    // Fire-and-forget — caller is in a sync hot path. Error swallowed
    // intentionally; secure-storage delete failure is non-recoverable
    // here and the next startSession() will overwrite.
    unawaited(_storage.delete(_storageKey).catchError((Object _) {}));
  }

  Future<void> _persist(Session s) async {
    await _storage.write(_storageKey, jsonEncode(s.toJson()));
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('SessionManager has been disposed');
    }
  }
}

/// In-memory fake of [SessionStorage] for tests.
class InMemorySessionStorage implements SessionStorage {
  final Map<String, String> _store = <String, String>{};

  @override
  Future<String?> read(String key) async => _store[key];

  @override
  Future<void> write(String key, String value) async {
    _store[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _store.remove(key);
  }

  /// Test-only: snapshot the underlying map.
  Map<String, String> snapshot() => Map<String, String>.unmodifiable(_store);
}

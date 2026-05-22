// ---------------------------------------------------------------------------
// session_manager.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA session lifecycle manager.
//
// What BELONGS in this file:
//   * Abstract `SessionManager` contract: JWT access + refresh token
//     handling, expiry tracking, idle / absolute timeouts, and binding
//     the multi-tenant `tenant_id` claim to every outgoing request.
//   * `Session` value object containing user id, tenant id, role, expiry.
//   * `SessionExpiredReason` enum so the router can route the user
//     correctly (idle → soft re-auth, absolute → full re-login,
//     `tenantSwitchRequired` → tenant picker screen).
//
// What does NOT belong here:
//   * Login UI — that lives in the app target.
//   * Concrete refresh-token HTTP calls — those live in the auth
//     repository implementation.
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

/// Authenticated session snapshot.
class Session {
  final String userId;
  final String tenantId;
  final String role; // Mirrors backend role (TENANT_RESIDENT, etc.)
  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiresAt;

  const Session({
    required this.userId,
    required this.tenantId,
    required this.role,
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
  });
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

/// Abstract session-manager contract.
///
/// Production implementation persists tokens to `flutter_secure_storage`,
/// schedules `Timer`s for idle / absolute timeouts, listens to
/// `WidgetsBindingObserver` lifecycle events, and triggers refresh
/// before the access token expires.
abstract class SessionManager {
  /// Currently active session, or null if not signed in.
  Session? get currentSession;

  /// Active tenant id (shorthand for `currentSession?.tenantId`).
  ///
  /// The Dio interceptor reads this on every request to inject the
  /// `x-tenant-id` header — DO NOT bypass it.
  String? get currentTenantId;

  /// Current session state — drives router redirects.
  SessionState get currentState;

  /// Stream of session state changes.
  Stream<SessionState> get onSessionStateChanged;

  /// Stream of expiry events with the reason.
  Stream<SessionExpiredReason> get onSessionExpired;

  /// Start tracking a fresh session after login.
  void startSession(Session session) {
    throw UnimplementedError(
      'startSession() must be implemented by SessionManager subclasses',
    );
  }

  /// Record any user activity to reset the idle timer.
  void recordActivity() {
    throw UnimplementedError(
      'recordActivity() must be implemented by SessionManager subclasses',
    );
  }

  /// Refresh the access token using the refresh token.
  ///
  /// Called automatically a few minutes before expiry and on 401
  /// responses surfaced by the Dio interceptor.
  Future<Session> refresh() {
    throw UnimplementedError(
      'refresh() must be implemented by SessionManager subclasses',
    );
  }

  /// Switch the active tenant for a multi-tenant user.
  ///
  /// Re-issues the access token bound to [tenantId]. Triggers a
  /// `SessionExpiredReason.tenantSwitchRequired` event if the current
  /// token can't be re-bound silently.
  Future<Session> switchTenant(String tenantId) {
    throw UnimplementedError(
      'switchTenant() must be implemented by SessionManager subclasses',
    );
  }

  /// End the session (logout). Clears secure storage and emits expired.
  Future<void> endSession() {
    throw UnimplementedError(
      'endSession() must be implemented by SessionManager subclasses',
    );
  }

  /// Release timers and stream controllers.
  void dispose() {
    throw UnimplementedError(
      'dispose() must be implemented by SessionManager subclasses',
    );
  }
}

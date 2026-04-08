import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

enum UserRole {
  resident,
  propertyManager,
  maintenanceStaff,
  tenantAdmin,
  owner,
  admin,
  support,
  superAdmin,
  accountant,
  unknown,
}

extension UserRoleExt on UserRole {
  bool get isCustomer => this == UserRole.resident;

  bool get isEstateManager =>
      this == UserRole.propertyManager ||
      this == UserRole.maintenanceStaff ||
      this == UserRole.tenantAdmin;

  bool get isOwner => this == UserRole.owner;

  bool get isAdmin =>
      this == UserRole.admin ||
      this == UserRole.support ||
      this == UserRole.superAdmin;

  bool get isAccountant => this == UserRole.accountant;
}

UserRole roleFromString(String? r) {
  if (r == null) return UserRole.unknown;
  switch (r.toUpperCase()) {
    case 'RESIDENT':
    case 'TENANT':
      return UserRole.resident;
    case 'PROPERTY_MANAGER':
    case 'ESTATE_MANAGER':
      return UserRole.propertyManager;
    case 'MAINTENANCE_STAFF':
      return UserRole.maintenanceStaff;
    case 'TENANT_ADMIN':
      return UserRole.tenantAdmin;
    case 'OWNER':
      return UserRole.owner;
    case 'ADMIN':
      return UserRole.admin;
    case 'SUPPORT':
      return UserRole.support;
    case 'SUPER_ADMIN':
      return UserRole.superAdmin;
    case 'ACCOUNTANT':
      return UserRole.accountant;
    default:
      return UserRole.unknown;
  }
}

class UserSession {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final String? tenantId;
  final String? tenantName;
  final UserRole role;
  final List<String> permissions;

  UserSession({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
    this.tenantId,
    this.tenantName,
    required this.role,
    this.permissions = const [],
  });

  String get displayName => '$firstName $lastName'.trim();
}

/// Lightweight JWT decoder (no external dep). Returns claims map or null.
@visibleForTesting
Map<String, dynamic>? decodeJwt(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3) return null;
    var payload = parts[1];
    // base64url padding
    switch (payload.length % 4) {
      case 2:
        payload += '==';
        break;
      case 3:
        payload += '=';
        break;
    }
    final decoded = utf8.decode(base64Url.decode(payload));
    final map = jsonDecode(decoded);
    if (map is Map<String, dynamic>) return map;
    return null;
  } catch (_) {
    return null;
  }
}

/// Returns true if the JWT is expired (or unparseable).
@visibleForTesting
bool isJwtExpired(String token, {DateTime? now}) {
  final claims = decodeJwt(token);
  if (claims == null) return true;
  final exp = claims['exp'];
  if (exp is! int) return false; // no exp → assume valid
  final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true);
  return (now ?? DateTime.now().toUtc()).isAfter(expiry);
}

class AuthProvider extends ChangeNotifier {
  static const _kAccessTokenKey = 'access_token';
  static const _kRefreshTokenKey = 'refresh_token';

  final ApiClient _api;
  final FlutterSecureStorage _storage;

  UserSession? _session;
  String? _token;
  String? _refreshToken;
  bool _loading = true;

  AuthProvider({
    required ApiClient api,
    FlutterSecureStorage? storage,
    bool autoRestore = true,
  })  : _api = api,
        _storage = storage ?? const FlutterSecureStorage() {
    // Hook the ApiClient so every request picks up the current token.
    _api.tokenProvider = () => _token;
    if (autoRestore) {
      // Fire and forget — UI observes `loading`.
      // ignore: discarded_futures
      restoreSession();
    } else {
      _loading = false;
    }
  }

  // ---- Public state -------------------------------------------------------

  UserSession? get session => _session;
  bool get isAuthenticated => _session != null && _token != null;
  bool get isLoading => _loading;
  bool get loading => _loading; // backwards compat with existing router
  String? get token => _token;
  String? get userId => _session?.id;
  String? get tenantId => _session?.tenantId;

  UserRole get role => _session?.role ?? UserRole.unknown;
  UserRole? get roleOrNull => _session?.role;

  bool get isCustomer => role.isCustomer;
  bool get isEstateManager => role.isEstateManager;
  bool get isOwner => role.isOwner;
  bool get isAdmin => role.isAdmin;
  bool get isAccountant => role.isAccountant;

  // ---- Core flows ---------------------------------------------------------

  /// Called on app startup. Reads tokens from secure storage, verifies the
  /// access token isn't expired, then hits `/auth/me` to hydrate the session.
  /// If the access token is expired but a refresh token exists, tries to
  /// refresh. On any failure, clears state silently.
  Future<void> restoreSession() async {
    _loading = true;
    notifyListeners();
    try {
      final stored = await _storage.read(key: _kAccessTokenKey);
      final storedRefresh = await _storage.read(key: _kRefreshTokenKey);
      _refreshToken = storedRefresh;

      if (stored == null || stored.isEmpty) {
        await _clearLocal();
        return;
      }

      if (isJwtExpired(stored)) {
        if (_refreshToken != null && _refreshToken!.isNotEmpty) {
          final refreshed = await _attemptRefresh();
          if (!refreshed) {
            await _clearLocal();
            return;
          }
        } else {
          await _clearLocal();
          return;
        }
      } else {
        _token = stored;
        _hydrateFromTokenClaims(stored);
      }

      final ok = await _fetchMe();
      if (!ok) {
        await _clearLocal();
      }
    } catch (_) {
      await _clearLocal();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Logs in with email/password. Stores JWT in secure storage, decodes
  /// it to extract role/userId/tenantId, and then calls `/auth/me`.
  /// Throws [AuthException] on failure.
  Future<void> login(String email, String password) async {
    _loading = true;
    notifyListeners();
    try {
      final resp = await _api.post<Map<String, dynamic>>(
        '/auth/login',
        body: {'email': email, 'password': password},
      );
      if (!resp.isOk || resp.data == null) {
        throw AuthException(resp.error ?? 'Login failed');
      }
      final data = resp.data!;
      final token = _extractToken(data);
      if (token == null) {
        throw AuthException('Login response did not contain a token');
      }
      final refresh = _extractRefreshToken(data);

      await _storage.write(key: _kAccessTokenKey, value: token);
      if (refresh != null) {
        await _storage.write(key: _kRefreshTokenKey, value: refresh);
      }
      _token = token;
      _refreshToken = refresh ?? _refreshToken;
      _hydrateFromTokenClaims(token);

      // Try to refine session from /auth/me, but don't hard-fail if the
      // endpoint isn't reachable — token claims already populated role etc.
      await _fetchMe();

      if (!isAuthenticated) {
        throw AuthException('Login succeeded but session is empty');
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Registers a new user. Same side-effects as [login] on success.
  Future<void> register(
    String email,
    String password,
    String firstName,
    String lastName, {
    String? phone,
  }) async {
    _loading = true;
    notifyListeners();
    try {
      final resp = await _api.post<Map<String, dynamic>>(
        '/auth/register',
        body: {
          'email': email,
          'password': password,
          'firstName': firstName,
          'lastName': lastName,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
        },
      );
      if (!resp.isOk || resp.data == null) {
        throw AuthException(resp.error ?? 'Registration failed');
      }
      final data = resp.data!;
      final token = _extractToken(data);
      if (token == null) {
        throw AuthException('Registration did not return a token');
      }
      final refresh = _extractRefreshToken(data);

      await _storage.write(key: _kAccessTokenKey, value: token);
      if (refresh != null) {
        await _storage.write(key: _kRefreshTokenKey, value: refresh);
      }
      _token = token;
      _refreshToken = refresh ?? _refreshToken;
      _hydrateFromTokenClaims(token);
      await _fetchMe();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Clears local session + tokens. Best-effort server logout.
  Future<void> logout() async {
    try {
      await _api.post<Map<String, dynamic>>('/auth/logout');
    } catch (_) {
      // ignore — logout must always succeed locally
    }
    await _clearLocal();
    notifyListeners();
  }

  /// Uses a stored refresh token to fetch a new access token.
  /// Returns silently on success; clears state on failure.
  Future<void> refreshToken() async {
    final ok = await _attemptRefresh();
    if (!ok) {
      await _clearLocal();
    }
    notifyListeners();
  }

  // ---- Internals ----------------------------------------------------------

  Future<bool> _attemptRefresh() async {
    final rt = _refreshToken;
    if (rt == null || rt.isEmpty) return false;
    try {
      final resp = await _api.post<Map<String, dynamic>>(
        '/auth/refresh',
        body: {'refreshToken': rt},
      );
      if (!resp.isOk || resp.data == null) return false;
      final data = resp.data!;
      final token = _extractToken(data);
      if (token == null) return false;
      final newRefresh = _extractRefreshToken(data);
      await _storage.write(key: _kAccessTokenKey, value: token);
      if (newRefresh != null) {
        await _storage.write(key: _kRefreshTokenKey, value: newRefresh);
        _refreshToken = newRefresh;
      }
      _token = token;
      _hydrateFromTokenClaims(token);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _fetchMe() async {
    try {
      final resp = await _api.get<Map<String, dynamic>>('/auth/me');
      if (!resp.isOk || resp.data == null) {
        // If server said 401, wipe; otherwise keep claim-based session.
        if (resp.statusCode == 401) return false;
        return _session != null;
      }
      final d = resp.data!;
      final user = d['user'] as Map<String, dynamic>? ?? d;
      final tenant = d['tenant'] as Map<String, dynamic>?;
      _session = UserSession(
        id: (user['id'] as String?) ?? _session?.id ?? '',
        email: (user['email'] as String?) ?? _session?.email ?? '',
        firstName: (user['firstName'] as String?) ?? _session?.firstName ?? '',
        lastName: (user['lastName'] as String?) ?? _session?.lastName ?? '',
        avatarUrl: user['avatarUrl'] as String?,
        tenantId:
            (tenant?['id'] as String?) ?? (user['tenantId'] as String?) ?? _session?.tenantId,
        tenantName: tenant?['name'] as String? ?? tenant?['slug'] as String?,
        role: roleFromString(
          (user['role'] as String?) ?? (d['role'] as String?),
        ),
        permissions: (d['permissions'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
      );
      return true;
    } catch (_) {
      return _session != null;
    }
  }

  /// Populate a minimal [UserSession] directly from JWT claims so the app
  /// can route even before `/auth/me` returns.
  void _hydrateFromTokenClaims(String token) {
    final claims = decodeJwt(token);
    if (claims == null) return;
    final id = (claims['sub'] ?? claims['userId'] ?? claims['id'])?.toString() ?? '';
    final email = (claims['email'] as String?) ?? '';
    final role = roleFromString(claims['role'] as String?);
    final tenantId =
        (claims['tenantId'] ?? claims['tenant_id'] ?? claims['tid'])?.toString();
    _session = UserSession(
      id: id,
      email: email,
      firstName: (claims['firstName'] as String?) ?? _session?.firstName ?? '',
      lastName: (claims['lastName'] as String?) ?? _session?.lastName ?? '',
      avatarUrl: _session?.avatarUrl,
      tenantId: tenantId ?? _session?.tenantId,
      tenantName: _session?.tenantName,
      role: role,
      permissions: (claims['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          _session?.permissions ??
          const [],
    );
  }

  String? _extractToken(Map<String, dynamic> data) {
    // Accept a variety of backend shapes.
    final direct = data['token'] ?? data['accessToken'] ?? data['access_token'];
    if (direct is String && direct.isNotEmpty) return direct;
    final nested = data['data'];
    if (nested is Map<String, dynamic>) return _extractToken(nested);
    return null;
  }

  String? _extractRefreshToken(Map<String, dynamic> data) {
    final direct = data['refreshToken'] ?? data['refresh_token'];
    if (direct is String && direct.isNotEmpty) return direct;
    final nested = data['data'];
    if (nested is Map<String, dynamic>) return _extractRefreshToken(nested);
    return null;
  }

  Future<void> _clearLocal() async {
    _session = null;
    _token = null;
    _refreshToken = null;
    try {
      await _storage.delete(key: _kAccessTokenKey);
      await _storage.delete(key: _kRefreshTokenKey);
    } catch (_) {}
  }
}

class AuthException implements Exception {
  final String message;
  AuthException(this.message);
  @override
  String toString() => message;
}

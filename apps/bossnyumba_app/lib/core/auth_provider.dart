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

class Membership {
  final String orgId;
  final String orgName;
  final UserRole role;

  Membership({
    required this.orgId,
    required this.orgName,
    required this.role,
  });

  factory Membership.fromJson(Map<String, dynamic> m) {
    final org = m['org'] as Map<String, dynamic>? ?? m;
    return Membership(
      orgId: (org['id'] ?? m['orgId'] ?? '').toString(),
      orgName:
          (org['name'] ?? org['slug'] ?? m['orgName'] ?? 'Organization').toString(),
      role: roleFromString(m['role'] as String?),
    );
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
  final List<Membership> memberships;

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
    this.memberships = const [],
  });

  String get displayName => '$firstName $lastName'.trim();
}

class Membership {
  final String userId;
  final String tenantId;
  final String tenantName;
  final String tenantSlug;
  final String? tenantStatus;
  final UserRole role;
  final List<String> permissions;

  Membership({
    required this.userId,
    required this.tenantId,
    required this.tenantName,
    required this.tenantSlug,
    this.tenantStatus,
    required this.role,
    this.permissions = const [],
  });

  factory Membership.fromJson(Map<String, dynamic> json) {
    return Membership(
      userId: json['userId'] as String? ?? '',
      tenantId: json['tenantId'] as String? ?? '',
      tenantName: json['tenantName'] as String? ?? '',
      tenantSlug: json['tenantSlug'] as String? ?? '',
      tenantStatus: json['tenantStatus'] as String?,
      role: roleFromString(json['role'] as String?),
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class AuthProvider extends ChangeNotifier {
  static const _tokenKey = 'access_token';
  static const _activeOrgKey = 'active_org_id';

  final ApiClient _api;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  UserSession? _session;
  List<Membership> _memberships = const [];
  String? _activeOrgId;
  bool _loading = true;

  AuthProvider({required ApiClient api}) : _api = api;

  UserSession? get session => _session;
  bool get isAuthenticated => _session != null;
  bool get loading => _loading;
  List<Membership> get memberships => _memberships;
  String? get activeOrgId => _activeOrgId;

  UserRole get role => _session?.role ?? UserRole.unknown;
  List<Membership> get memberships => _session?.memberships ?? const [];

  bool get isCustomer => role.isCustomer;
  bool get isEstateManager => role.isEstateManager;
  bool get isOwner => role.isOwner;
  bool get isAdmin => role.isAdmin;
  bool get isAccountant => role.isAccountant;

  Future<void> _init() async {
    final token = await _storage.read(key: _tokenKey);
    final storedOrg = await _storage.read(key: _activeOrgKey);
    if (token != null) {
      _api.setToken(token);
      if (storedOrg != null) {
        _api.setActiveOrg(storedOrg);
        _activeOrgId = storedOrg;
      }
      await _fetchMe();
    }
  }

  void _applySessionFromMe(Map<String, dynamic> d) {
    final user = (d['user'] as Map<String, dynamic>?) ?? d;
    final tenant = d['tenant'] as Map<String, dynamic>?;
    _session = UserSession(
      id: user['id'] as String? ?? '',
      email: user['email'] as String? ?? '',
      firstName: user['firstName'] as String? ?? '',
      lastName: user['lastName'] as String? ?? '',
      avatarUrl: user['avatarUrl'] as String?,
      tenantId: tenant?['id'] as String?,
      tenantName: tenant?['name'] as String? ?? tenant?['slug'] as String?,
      role: roleFromString(user['role'] as String? ?? d['role'] as String?),
      permissions: (d['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );

    _memberships = ((d['memberships'] as List<dynamic>?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Membership.fromJson)
        .toList();

    final nextOrgId =
        d['activeOrgId'] as String? ?? tenant?['id'] as String?;
    if (nextOrgId != null) {
      _activeOrgId = nextOrgId;
      _api.setActiveOrg(nextOrgId);
      // fire and forget — safe to persist in background
      _storage.write(key: _activeOrgKey, value: nextOrgId);
    }
  }

  Future<void> _fetchMe() async {
    final resp = await _api.get<Map<String, dynamic>>('/auth/me');
    if (resp.isOk && resp.data != null) {
      _applySessionFromMe(resp.data!);
    } else {
      _session = null;
      _memberships = const [];
      _activeOrgId = null;
      await _storage.delete(key: _tokenKey);
      await _storage.delete(key: _activeOrgKey);
      _api.setToken(null);
      _api.setActiveOrg(null);
    }
    notifyListeners();
  }

  /// Returns `null` on success, or a human-readable error message on failure.
  /// Callers that want boolean behaviour can check `isAuthenticated` after.
  Future<String?> login(String email, String password) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/login', body: {
      'email': email,
      'password': password,
    });
    if (!resp.isOk) {
      return resp.error ?? 'Login failed';
    }
    final d = resp.data;
    final token = d is Map ? d['token'] as String? : null;
    if (token == null) {
      return 'Login response missing token';
    }
    await _storage.write(key: _tokenKey, value: token);
    _api.setToken(token);
    // Apply session synchronously from the login response so memberships are
    // available immediately for the org picker.
    if (d is Map<String, dynamic>) {
      _applySessionFromMe(d);
    }
    // Also fetch /auth/me to confirm and get any X-Active-Org normalisations.
    await _fetchMe();
    return isAuthenticated ? null : 'Login failed';
  }

  Future<String?> register(
    String email,
    String password,
    String firstName,
    String lastName, {
    String? phone,
  }) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/register', body: {
      'email': email,
      'password': password,
      'firstName': firstName,
      'lastName': lastName,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    if (!resp.isOk) return resp.error ?? 'Registration failed';
    final d = resp.data;
    final token = d is Map ? d['token'] as String? : null;
    if (token == null) return 'Registration response missing token';
    await _storage.write(key: _tokenKey, value: token);
    _api.setToken(token);
    if (d is Map<String, dynamic>) {
      _applySessionFromMe(d);
    }
    await _fetchMe();
    return isAuthenticated ? null : 'Registration failed';
  }

  Future<String?> setActiveOrg(String tenantId) async {
    if (tenantId.isEmpty) return 'tenantId is required';
    // Optimistic update: all subsequent calls carry X-Active-Org immediately.
    _activeOrgId = tenantId;
    _api.setActiveOrg(tenantId);
    await _storage.write(key: _activeOrgKey, value: tenantId);

    final resp = await _api.post<Map<String, dynamic>>(
      '/auth/switch-org',
      body: {'tenantId': tenantId},
    );
    if (!resp.isOk) {
      return resp.error ?? 'Failed to switch organization';
    }
    final d = resp.data;
    if (d is Map<String, dynamic>) {
      final token = d['token'] as String?;
      if (token != null) {
        await _storage.write(key: _tokenKey, value: token);
        _api.setToken(token);
      }
      _applySessionFromMe(d);
    }
    notifyListeners();
    return null;
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _activeOrgKey);
    _api.setToken(null);
    _api.setActiveOrg(null);
    _session = null;
    _memberships = const [];
    _activeOrgId = null;
    notifyListeners();
  }
}

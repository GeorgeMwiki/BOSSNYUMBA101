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
  bool get isCustomer =>
      this == UserRole.resident;

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

class AuthProvider extends ChangeNotifier {
  final ApiClient _api;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  UserSession? _session;
  bool _loading = true;

  AuthProvider({required ApiClient api}) : _api = api {
    _init();
  }

  UserSession? get session => _session;
  bool get isAuthenticated => _session != null;
  bool get loading => _loading;

  UserRole get role => _session?.role ?? UserRole.unknown;

  bool get isCustomer => role.isCustomer;
  bool get isEstateManager => role.isEstateManager;
  bool get isOwner => role.isOwner;
  bool get isAdmin => role.isAdmin;
  bool get isAccountant => role.isAccountant;

  Future<void> _init() async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      _api.setToken(token);
      await _fetchMe();
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> _fetchMe() async {
    final resp = await _api.get<Map<String, dynamic>>('/auth/me');
    if (resp.isOk && resp.data != null) {
      final d = resp.data!;
      final user = d['user'] as Map<String, dynamic>? ?? d;
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
            [],
      );
    } else {
      _session = null;
      await _storage.delete(key: 'access_token');
      _api.setToken(null);
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/login', body: {
      'email': email,
      'password': password,
    });
    if (!resp.isOk) return false;
    final d = resp.data;
    final token = d is Map ? d['token'] as String? : null;
    if (token == null) return false;
    await _storage.write(key: 'access_token', value: token);
    _api.setToken(token);
    await _fetchMe();
    return isAuthenticated;
  }

  Future<bool> register(
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
    if (!resp.isOk) return false;
    final d = resp.data;
    final token = d is Map ? d['token'] as String? : null;
    if (token == null) return false;
    await _storage.write(key: 'access_token', value: token);
    _api.setToken(token);
    await _fetchMe();
    return isAuthenticated;
  }

  Future<void> logout() async {
    await _storage.delete(key: 'access_token');
    _api.setToken(null);
    _session = null;
    notifyListeners();
  }
}

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

// ============================================================================
// Roles - includes TECHNICIAN (mobile-only)
// ============================================================================

enum UserRole {
  resident,
  propertyManager,
  maintenanceStaff,
  tenantAdmin,
  technician, // Mobile-only - no web access
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

  bool get isTechnician => this == UserRole.technician;

  bool get isOwner => this == UserRole.owner;

  bool get isAdmin =>
      this == UserRole.admin ||
      this == UserRole.support ||
      this == UserRole.superAdmin;

  bool get isAccountant => this == UserRole.accountant;

  String get displayName {
    switch (this) {
      case UserRole.resident:
        return 'Tenant';
      case UserRole.propertyManager:
        return 'Property Manager';
      case UserRole.maintenanceStaff:
        return 'Maintenance Staff';
      case UserRole.tenantAdmin:
        return 'Tenant Admin';
      case UserRole.technician:
        return 'Technician';
      case UserRole.owner:
        return 'Owner';
      case UserRole.admin:
        return 'Admin';
      case UserRole.support:
        return 'Support';
      case UserRole.superAdmin:
        return 'Super Admin';
      case UserRole.accountant:
        return 'Accountant';
      case UserRole.unknown:
        return 'User';
    }
  }
}

UserRole roleFromString(String? r) {
  if (r == null) return UserRole.unknown;
  switch (r.toUpperCase()) {
    case 'RESIDENT':
    case 'TENANT':
      return UserRole.resident;
    case 'PROPERTY_MANAGER':
    case 'ESTATE_MANAGER':
    case 'MANAGER':
      return UserRole.propertyManager;
    case 'MAINTENANCE_STAFF':
      return UserRole.maintenanceStaff;
    case 'TENANT_ADMIN':
      return UserRole.tenantAdmin;
    case 'TECHNICIAN':
      return UserRole.technician;
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

// ============================================================================
// Dynamic User Context (one user can be owner AND tenant simultaneously)
// ============================================================================

class UserContext {
  final String id;
  final String contextType;
  final String? tenantId;
  final bool isPrimary;
  final String? displayName;
  final String entityType;
  final String? companyName;
  final List<String> enabledFeatures;
  final bool onboardingCompleted;
  final String? onboardingStep;

  UserContext({
    required this.id,
    required this.contextType,
    this.tenantId,
    this.isPrimary = false,
    this.displayName,
    this.entityType = 'individual',
    this.companyName,
    this.enabledFeatures = const [],
    this.onboardingCompleted = false,
    this.onboardingStep,
  });

  factory UserContext.fromJson(Map<String, dynamic> json) {
    return UserContext(
      id: json['id'] as String? ?? '',
      contextType: json['contextType'] as String? ?? 'tenant',
      tenantId: json['tenantId'] as String?,
      isPrimary: json['isPrimary'] as bool? ?? false,
      displayName: json['displayName'] as String?,
      entityType: json['entityType'] as String? ?? 'individual',
      companyName: json['companyName'] as String?,
      enabledFeatures: (json['enabledFeatures'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      onboardingCompleted: json['onboardingCompleted'] as bool? ?? false,
      onboardingStep: json['onboardingStep'] as String?,
    );
  }

  UserRole get role => roleFromString(contextType);
}

// ============================================================================
// Session
// ============================================================================

class UserSession {
  final String id;
  final String email;
  final String phone;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final String? tenantId;
  final String? tenantName;
  final UserRole role;
  final List<String> permissions;
  final List<UserContext> contexts;
  final UserContext? activeContext;

  UserSession({
    required this.id,
    required this.email,
    this.phone = '',
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
    this.tenantId,
    this.tenantName,
    required this.role,
    this.permissions = const [],
    this.contexts = const [],
    this.activeContext,
  });

  String get displayName => '$firstName $lastName'.trim();
}

// ============================================================================
// Auth Provider (v2 with Supabase + phone OTP + context switching)
// ============================================================================

class AuthProvider extends ChangeNotifier {
  final ApiClient _api;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  UserSession? _session;
  bool _loading = true;
  String? _otpPhone;

  AuthProvider({required ApiClient api}) : _api = api {
    _init();
  }

  UserSession? get session => _session;
  bool get isAuthenticated => _session != null;
  bool get loading => _loading;
  String? get otpPhone => _otpPhone;

  UserRole get role => _session?.activeContext?.role ?? _session?.role ?? UserRole.unknown;
  List<UserContext> get contexts => _session?.contexts ?? [];
  UserContext? get activeContext => _session?.activeContext;

  bool get isCustomer => role.isCustomer;
  bool get isEstateManager => role.isEstateManager;
  bool get isTechnician => role.isTechnician;
  bool get isOwner => role.isOwner;
  bool get isAdmin => role.isAdmin;
  bool get isAccountant => role.isAccountant;

  // ========================================================================
  // Init - restore session from stored token
  // ========================================================================

  Future<void> _init() async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      _api.setToken(token);
      await _fetchProfile();
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> _fetchProfile() async {
    // Try v2 auth first
    final v2Resp = await _api.get<Map<String, dynamic>>('/auth/v2/me');
    if (v2Resp.isOk && v2Resp.data != null) {
      _buildSessionFromV2(v2Resp.data!);
      return;
    }

    // Fallback to legacy
    final resp = await _api.get<Map<String, dynamic>>('/auth/me');
    if (resp.isOk && resp.data != null) {
      _buildSessionFromLegacy(resp.data!);
    } else {
      _session = null;
      await _storage.delete(key: 'access_token');
      _api.setToken(null);
    }
  }

  void _buildSessionFromV2(Map<String, dynamic> data) {
    final profile = data['profile'] as Map<String, dynamic>? ?? data;
    final ctxList = (data['contexts'] as List<dynamic>?) ?? [];
    final activeCtx = data['activeContext'] as Map<String, dynamic>?;

    final contexts = ctxList
        .map((c) => UserContext.fromJson(c as Map<String, dynamic>))
        .toList();
    final active = activeCtx != null
        ? UserContext.fromJson(activeCtx)
        : (contexts.isNotEmpty ? contexts.first : null);

    _session = UserSession(
      id: profile['id'] as String? ?? profile['authUid'] as String? ?? '',
      email: profile['email'] as String? ?? '',
      phone: profile['phone'] as String? ?? '',
      firstName: profile['firstName'] as String? ?? '',
      lastName: profile['lastName'] as String? ?? '',
      avatarUrl: profile['avatarUrl'] as String?,
      tenantId: active?.tenantId,
      role: active?.role ?? UserRole.resident,
      contexts: contexts,
      activeContext: active,
    );
    notifyListeners();
  }

  void _buildSessionFromLegacy(Map<String, dynamic> d) {
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
    notifyListeners();
  }

  // ========================================================================
  // Phone OTP Login (mobile-first for Tanzania market)
  // ========================================================================

  Future<bool> sendOtp(String phone) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/v2/phone/send-otp', body: {
      'phone': phone,
    });
    if (resp.isOk) {
      _otpPhone = phone;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> verifyOtp(String otp) async {
    if (_otpPhone == null) return false;
    final resp = await _api.post<Map<String, dynamic>>('/auth/v2/phone/verify', body: {
      'phone': _otpPhone,
      'otp': otp,
    });
    if (!resp.isOk || resp.data == null) return false;
    final data = resp.data!;
    final token = data['token'] as String?;
    if (token == null) return false;

    await _storage.write(key: 'access_token', value: token);
    if (data['refreshToken'] != null) {
      await _storage.write(key: 'refresh_token', value: data['refreshToken'] as String);
    }
    _api.setToken(token);
    _buildSessionFromV2(data);
    _otpPhone = null;
    return isAuthenticated;
  }

  // ========================================================================
  // Email/Password Login
  // ========================================================================

  Future<bool> login(String email, String password) async {
    // Try v2 first
    final v2Resp = await _api.post<Map<String, dynamic>>('/auth/v2/login', body: {
      'email': email,
      'password': password,
    });
    if (v2Resp.isOk && v2Resp.data != null) {
      final data = v2Resp.data!;
      final token = data['token'] as String?;
      if (token != null) {
        await _storage.write(key: 'access_token', value: token);
        if (data['refreshToken'] != null) {
          await _storage.write(key: 'refresh_token', value: data['refreshToken'] as String);
        }
        _api.setToken(token);
        _buildSessionFromV2(data);
        return isAuthenticated;
      }
    }

    // Fallback to legacy
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
    await _fetchProfile();
    return isAuthenticated;
  }

  // ========================================================================
  // Registration
  // ========================================================================

  Future<bool> registerWithPhone(String phone, String firstName, String lastName) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/v2/register/phone', body: {
      'phone': phone,
      'firstName': firstName,
      'lastName': lastName,
    });
    if (resp.isOk) {
      _otpPhone = phone;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> registerWithEmail(String email, String password, String firstName, String lastName, {String? phone}) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/v2/register/email', body: {
      'email': email,
      'password': password,
      'firstName': firstName,
      'lastName': lastName,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    if (!resp.isOk || resp.data == null) return false;
    final data = resp.data!;
    final token = data['token'] as String?;
    if (token != null) {
      await _storage.write(key: 'access_token', value: token);
      _api.setToken(token);
      _buildSessionFromV2(data);
      return isAuthenticated;
    }
    return true; // Signup success but may need email verification
  }

  // ========================================================================
  // Context Switching (owner <-> tenant <-> technician)
  // ========================================================================

  Future<bool> switchContext(String contextId) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/v2/contexts/switch', body: {
      'contextId': contextId,
    });
    if (resp.isOk && resp.data != null) {
      await _fetchProfile();
      return true;
    }
    return false;
  }

  Future<bool> createContext(String contextType, {String? displayName, String? entityType, String? companyName}) async {
    final resp = await _api.post<Map<String, dynamic>>('/auth/v2/contexts', body: {
      'contextType': contextType,
      if (displayName != null) 'displayName': displayName,
      if (entityType != null) 'entityType': entityType,
      if (companyName != null) 'companyName': companyName,
    });
    if (resp.isOk) {
      await _fetchProfile();
      return true;
    }
    return false;
  }

  // ========================================================================
  // Logout
  // ========================================================================

  Future<void> logout() async {
    _api.post('/auth/v2/logout').catchError((_) => ApiResponse<dynamic>.error(''));
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
    _api.setToken(null);
    _session = null;
    _otpPhone = null;
    notifyListeners();
  }
}

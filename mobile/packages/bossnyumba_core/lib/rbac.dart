// ---------------------------------------------------------------------------
// rbac.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA mobile RBAC policy.
//
// What BELONGS in this file:
//   * `MobileRole` enum mirroring backend role identifiers exactly.
//     The names MUST stay in sync with the web RBAC matrix at
//     `packages/rbac/src/roles.ts` (or wherever the canonical roles
//     live in the backend codebase).
//   * `MobileAccessPolicy` — static configuration: which roles may
//     even use the mobile apps, which permissions are restricted
//     from mobile (e.g. bulk exports), and what entity caches are
//     allowed offline.
//   * Pure helper functions: `isRoleAllowed`, `isPermissionAllowed`,
//     `isOfflineExpired`.
//
// What does NOT belong here:
//   * Concrete authorisation calls — those live in the API client
//     interceptor.
//   * UI guard widgets — those live in the app target.
// ---------------------------------------------------------------------------

/// Mobile-relevant BOSSNYUMBA roles (mirrors backend exactly).
///
/// String values match the wire-format identifier the backend uses
/// in JWTs and RBAC checks. DO NOT rename these without coordinating
/// a backend release.
enum MobileRole {
  tenantResident('TENANT_RESIDENT'),
  ownerAdvisor('OWNER_ADVISOR'),
  estateManager('ESTATE_MANAGER'),
  buildingSupervisor('BUILDING_SUPERVISOR'),
  inspector('INSPECTOR'),
  superAdmin('SUPER_ADMIN');

  final String wire;
  const MobileRole(this.wire);

  static MobileRole? fromWire(String wire) {
    for (final r in MobileRole.values) {
      if (r.wire == wire) return r;
    }
    return null;
  }
}

/// Mobile access policy.
///
/// Direct Dart mirror of the backend mobile-policy module. Defines
/// which roles may use the mobile apps, which permissions are
/// blocked on mobile (because they require a desktop interface),
/// and offline-cache rules.
class MobileAccessPolicy {
  MobileAccessPolicy._();

  /// Roles permitted to sign in on the mobile apps.
  static const allowedRoles = [
    MobileRole.tenantResident,
    MobileRole.ownerAdvisor,
    MobileRole.estateManager,
    MobileRole.buildingSupervisor,
    MobileRole.inspector,
    MobileRole.superAdmin,
  ];

  /// Device security requirements (feature-flagged for MVP).
  static const mdmEnrolled = false;
  static const diskEncryption = true;
  static const minIosVersion = '16.0';
  static const minAndroidVersion = '13';
  static const jailbreakDetection = true;
  static const biometricRequired = true;

  /// Permissions that exist in the system but are NOT available on
  /// mobile. The mobile API client should refuse to even attempt
  /// these — they require the web operator console.
  static const restrictedPermissions = <String>[
    'auditlog.export',
    'tenant.bulk_import',
    'tenant.bulk_export',
    'lease.bulk_renew',
    'payment.bulk_reconcile',
    'admin.manage_users',
    'admin.manage_roles',
    'admin.edit_system_config',
    'reports.finalize',
    'documents.bulk_download',
  ];

  /// Whether offline mode is enabled at all.
  static const offlineEnabled = true;

  /// Scope of cached data — only entities tied to the current
  /// tenant_id are ever stored offline.
  static const offlineScope = 'current_tenant_only';

  /// Hard limit on offline duration; beyond this the sync engine
  /// refuses further mutations until reconnection.
  static const maxOfflineHours = 72;

  /// Sync-on-reconnect strategy.
  static const syncOnReconnect = 'mandatory';

  /// Conflict resolution policy. Must match `sync_engine.dart`.
  static const conflictResolution = 'server_wins_with_audit';

  /// Entity types permitted in the local cache.
  static const cachedDataTypes = <String>[
    'property',
    'unit',
    'lease',
    'tenant',
    'payment',
    'maintenance_ticket',
  ];

  /// True if [role] is permitted on mobile at all.
  static bool isRoleAllowed(MobileRole role) => allowedRoles.contains(role);

  /// True if [permission] is allowed on mobile (i.e. not restricted).
  static bool isPermissionAllowed(String permission) {
    return !restrictedPermissions.contains(permission);
  }

  /// True if the offline cache has aged past [maxOfflineHours].
  static bool isOfflineExpired(DateTime lastSync) {
    final hoursSinceSync = DateTime.now().difference(lastSync).inHours;
    return hoursSinceSync > maxOfflineHours;
  }
}

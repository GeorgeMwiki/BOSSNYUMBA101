// ---------------------------------------------------------------------------
// database/database.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA local encrypted database.
//
// What BELONGS in this file:
//   * Drift table declarations for the BOSSNYUMBA cached entities
//     (Property, Unit, Lease, Tenant, Payment, MaintenanceTicket) plus
//     the sync outbox.
//   * The `BossnyumbaDatabase` Drift class binding the schema to a
//     SQLCipher-backed `NativeDatabase`.
//   * Migration strategy stub for future schema versions.
//   * Encryption-key bootstrapping helper that pulls the AES-256 key
//     from `flutter_secure_storage` (Keychain on iOS,
//     EncryptedSharedPreferences on Android).
//
// What does NOT belong here:
//   * Business logic — DAOs and repositories go in sibling files
//     under `daos/` and `repositories/` (to be added).
//   * Network sync — that lives in `../sync_engine.dart`.
//
// IMPORTANT:
//   * `flutter pub run build_runner build` is required after editing
//     the table definitions to regenerate the companion `database.g.dart`.
//   * All cached rows MUST carry a `tenantId` column. The repositories
//     filter by the active tenant from `SessionManager.currentTenantId`
//     before returning rows — never trust an unscoped query.
// ---------------------------------------------------------------------------

import 'package:drift/drift.dart';

// ════════════════════════════════════════════════════════════════════════════
// Sync outbox
// ════════════════════════════════════════════════════════════════════════════

/// Offline mutation queue — see `../sync_engine.dart` for the contract.
@DataClassName('SyncQueueEntry')
class SyncQueueTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get mutationId => text()(); // UUID v4
  TextColumn get tenantId => text()();
  TextColumn get entity => text()(); // SyncEntity.name
  TextColumn get url => text()();
  TextColumn get method => text()(); // GET, POST, PUT, DELETE
  TextColumn get body => text().nullable()(); // JSON-encoded body
  TextColumn get headers => text().nullable()(); // JSON-encoded headers
  IntColumn get timestamp => integer()(); // Unix millis
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get errorMessage => text().nullable()();
  DateTimeColumn get createdAt =>
      dateTime().withDefault(currentDateAndTime)();
}

// ════════════════════════════════════════════════════════════════════════════
// Entity caches — every row is scoped by `tenantId`.
// ════════════════════════════════════════════════════════════════════════════

/// Cached property / building / estate.
@DataClassName('CachedProperty')
class CachedPropertiesTable extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get name => text()();
  TextColumn get addressLine => text().nullable()();
  RealColumn get latitude => real().nullable()();
  RealColumn get longitude => real().nullable()();
  IntColumn get totalUnits => integer().withDefault(const Constant(0))();
  TextColumn get dataJson => text()(); // Full JSON for fields not modelled
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached rentable unit.
@DataClassName('CachedUnit')
class CachedUnitsTable extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get propertyId => text()();
  TextColumn get unitNumber => text()();
  TextColumn get status =>
      text()(); // vacant | occupied | maintenance | reserved
  RealColumn get monthlyRent => real().nullable()();
  TextColumn get currency => text().withDefault(const Constant('TZS'))();
  TextColumn get dataJson => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached lease agreement.
@DataClassName('CachedLease')
class CachedLeasesTable extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get unitId => text()();
  TextColumn get residentId => text()();
  DateTimeColumn get startDate => dateTime()();
  DateTimeColumn get endDate => dateTime().nullable()();
  RealColumn get rentAmount => real()();
  TextColumn get currency => text().withDefault(const Constant('TZS'))();
  TextColumn get status => text()(); // active | ended | pending_signature
  TextColumn get dataJson => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached resident / tenant profile.
@DataClassName('CachedTenantProfile')
class CachedTenantProfilesTable extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()(); // org-tenant, not resident
  TextColumn get fullName => text()();
  TextColumn get phone => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get nationalId => text().nullable()(); // NIDA
  TextColumn get dataJson => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached rent / fee payment.
@DataClassName('CachedPayment')
class CachedPaymentsTable extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get leaseId => text()();
  TextColumn get residentId => text()();
  RealColumn get amount => real()();
  TextColumn get currency => text().withDefault(const Constant('TZS'))();
  TextColumn get method =>
      text()(); // mpesa | tigopesa | airtelmoney | bank | cash
  TextColumn get status =>
      text()(); // pending | succeeded | failed | reversed
  TextColumn get externalRef => text().nullable()(); // M-Pesa CheckoutRequestID
  DateTimeColumn get occurredAt => dateTime()();
  TextColumn get dataJson => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached maintenance ticket.
@DataClassName('CachedMaintenanceTicket')
class CachedMaintenanceTicketsTable extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get unitId => text()();
  TextColumn get raisedById => text()();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  TextColumn get category =>
      text()(); // plumbing | electrical | structural | other
  TextColumn get severity => text()(); // low | medium | high | critical
  TextColumn get status =>
      text()(); // open | assigned | in_progress | resolved | closed
  TextColumn get dataJson => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

// ════════════════════════════════════════════════════════════════════════════
// Database
// ════════════════════════════════════════════════════════════════════════════

/// BOSSNYUMBA encrypted local database.
///
/// NOTE: Concrete `_$BossnyumbaDatabase` mixin is generated by
/// `flutter pub run build_runner build` once tables stabilise.
/// Until then the file intentionally documents the schema without
/// declaring the `part 'database.g.dart'` directive.
@DriftDatabase(
  tables: [
    SyncQueueTable,
    CachedPropertiesTable,
    CachedUnitsTable,
    CachedLeasesTable,
    CachedTenantProfilesTable,
    CachedPaymentsTable,
    CachedMaintenanceTicketsTable,
  ],
)
abstract class BossnyumbaDatabase {
  /// Current schema version. Bump and add a step to [migration] when
  /// changing tables.
  int get schemaVersion => 1;

  /// Wipe all caches (e.g. on logout). Outbox is preserved unless the
  /// caller separately invokes [clearSyncQueue].
  Future<void> clearAllCaches() {
    throw UnimplementedError(
      'clearAllCaches() must be implemented by BossnyumbaDatabase subclasses',
    );
  }

  /// Wipe the sync outbox. CAUTION — discards pending mutations.
  Future<void> clearSyncQueue() {
    throw UnimplementedError(
      'clearSyncQueue() must be implemented by BossnyumbaDatabase subclasses',
    );
  }

  /// Nuclear reset for account switching / GDPR delete.
  Future<void> resetDatabase() {
    throw UnimplementedError(
      'resetDatabase() must be implemented by BossnyumbaDatabase subclasses',
    );
  }
}

// ---------------------------------------------------------------------------
// database/database.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA local encrypted database — schema declarations only.
//
// What BELONGS in this file:
//   * Drift `Table` declarations for the BOSSNYUMBA cached entities
//     (Property, Unit, Lease, Tenant, Payment, MaintenanceTicket) plus
//     the sync outbox.
//   * An abstract `BossnyumbaDatabase` interface that the app code
//     depends on, so tests can swap in an in-memory implementation
//     without booting SQLCipher.
//
// What does NOT belong here:
//   * The concrete `@DriftDatabase` class with generated mixin — that
//     lives in `database_drift.dart` (added once `build_runner` is
//     wired up).  Keeping the annotation out of THIS file prevents
//     `dart analyze` from demanding `part 'database.g.dart';` before
//     code-gen has produced it.
//   * Business logic — DAOs / repositories go in sibling files.
//   * Network sync — that lives in `../sync_engine.dart`.
//
// IMPORTANT:
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
  Set<Column<dynamic>> get primaryKey => <Column<dynamic>>{id};
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
  Set<Column<dynamic>> get primaryKey => <Column<dynamic>>{id};
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
  Set<Column<dynamic>> get primaryKey => <Column<dynamic>>{id};
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
  Set<Column<dynamic>> get primaryKey => <Column<dynamic>>{id};
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
  TextColumn get externalRef =>
      text().nullable()(); // M-Pesa CheckoutRequestID
  DateTimeColumn get occurredAt => dateTime()();
  TextColumn get dataJson => text()();
  DateTimeColumn get cachedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column<dynamic>> get primaryKey => <Column<dynamic>>{id};
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
  Set<Column<dynamic>> get primaryKey => <Column<dynamic>>{id};
}

// ════════════════════════════════════════════════════════════════════════════
// Database interface
// ════════════════════════════════════════════════════════════════════════════

/// Abstract interface app code depends on.
///
/// Production implementation lives in `database_drift.dart` and adds
/// the `@DriftDatabase(tables: [...])` annotation + the generated
/// `_$BossnyumbaDatabase` mixin. Tests use [InMemoryBossnyumbaDatabase].
abstract class BossnyumbaDatabase {
  /// Current schema version.
  int get schemaVersion;

  /// Wipe all caches (e.g. on logout). Outbox is preserved unless the
  /// caller separately invokes [clearSyncQueue].
  Future<void> clearAllCaches();

  /// Wipe the sync outbox. CAUTION — discards pending mutations.
  Future<void> clearSyncQueue();

  /// Nuclear reset for account switching / GDPR delete.
  Future<void> resetDatabase();
}

/// In-memory no-op for tests / scaffolding before SQLCipher is wired.
class InMemoryBossnyumbaDatabase implements BossnyumbaDatabase {
  bool cachesCleared = false;
  bool queueCleared = false;
  bool databaseReset = false;

  @override
  int get schemaVersion => 1;

  @override
  Future<void> clearAllCaches() async {
    cachesCleared = true;
  }

  @override
  Future<void> clearSyncQueue() async {
    queueCleared = true;
  }

  @override
  Future<void> resetDatabase() async {
    databaseReset = true;
    cachesCleared = true;
    queueCleared = true;
  }
}

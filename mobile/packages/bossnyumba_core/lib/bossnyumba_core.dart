/// BOSSNYUMBA Core — Shared library for BOSSNYUMBA mobile apps.
///
/// Provides the offline-first sync engine, biometric authentication,
/// JWT + tenant-scoped session management, local encrypted database
/// (Drift / SQLCipher), connectivity monitoring, RBAC policy, and
/// geospatial helpers.
///
/// This barrel re-exports the public surface so app code can import
/// the package once:
///
/// ```dart
/// import 'package:bossnyumba_core/bossnyumba_core.dart';
/// ```
library bossnyumba_core;

// Sync / offline
export 'sync_engine.dart';
export 'connectivity_monitor.dart';

// Auth
export 'biometric_service.dart';
export 'session_manager.dart';

// Database
export 'database/database.dart';

// Geolocation
export 'geolocation/haversine.dart';

// RBAC
export 'rbac.dart';

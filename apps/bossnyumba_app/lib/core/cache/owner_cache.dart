// owner_cache.dart
//
// Central offline cache for the owner role. Wraps a simple key/value
// store (SharedPreferences by default; Hive can drop in via the
// [OwnerCacheStore] seam) and exposes typed methods for the slices of
// state the owner experience needs to remain usable while offline.
//
// Design notes:
// * Every entry is wrapped in a [CachedEntry] envelope that records the
//   `savedAt` wall-clock so we can flag stale reads without deleting
//   them. A stale-but-present read is almost always better than a blank
//   screen when the owner is in a basement with no signal.
// * All reads are synchronous-ish `Future`s so callers can `await` once
//   and treat cache + network identically.
// * `clearAll()` is called from logout to avoid leaking another user's
//   portfolio into the next login.

import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Thin abstraction over the underlying KV store so we can swap
/// SharedPreferences for Hive later without rewriting call sites.
abstract class OwnerCacheStore {
  Future<String?> readString(String key);
  Future<void> writeString(String key, String value);
  Future<void> remove(String key);
  Future<Set<String>> keys();
  Future<void> clear();
}

/// Default [OwnerCacheStore] implementation backed by SharedPreferences.
/// We deliberately scope keys with a prefix so `clearAll()` only wipes
/// cache entries and leaves unrelated prefs (auth state, feature flags,
/// etc.) untouched.
class SharedPrefsOwnerCacheStore implements OwnerCacheStore {
  static const String prefix = 'owner_cache::';

  final Future<SharedPreferences> _prefs;

  SharedPrefsOwnerCacheStore({Future<SharedPreferences>? prefs})
      : _prefs = prefs ?? SharedPreferences.getInstance();

  @override
  Future<String?> readString(String key) async {
    final p = await _prefs;
    return p.getString('$prefix$key');
  }

  @override
  Future<void> writeString(String key, String value) async {
    final p = await _prefs;
    await p.setString('$prefix$key', value);
  }

  @override
  Future<void> remove(String key) async {
    final p = await _prefs;
    await p.remove('$prefix$key');
  }

  @override
  Future<Set<String>> keys() async {
    final p = await _prefs;
    return p
        .getKeys()
        .where((k) => k.startsWith(prefix))
        .map((k) => k.substring(prefix.length))
        .toSet();
  }

  @override
  Future<void> clear() async {
    final p = await _prefs;
    final targets = p.getKeys().where((k) => k.startsWith(prefix)).toList();
    for (final k in targets) {
      await p.remove(k);
    }
  }
}

/// In-memory store, useful in tests so they don't touch disk.
class InMemoryOwnerCacheStore implements OwnerCacheStore {
  final Map<String, String> _data = {};

  @override
  Future<String?> readString(String key) async => _data[key];

  @override
  Future<void> writeString(String key, String value) async {
    _data[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    _data.remove(key);
  }

  @override
  Future<Set<String>> keys() async => _data.keys.toSet();

  @override
  Future<void> clear() async => _data.clear();
}

/// Envelope wrapping a cached payload with the time it was saved.
class CachedEntry<T> {
  final T value;
  final DateTime savedAt;
  final bool stale;

  const CachedEntry({
    required this.value,
    required this.savedAt,
    required this.stale,
  });
}

/// Central cache surface for the owner role.
class OwnerCache {
  final OwnerCacheStore _store;
  final Duration cacheTtl;

  /// Maximum number of tenant/notification entries we keep per org. We
  /// deliberately cap both to stay bounded on mid-range Android devices.
  static const int maxTenants = 50;
  static const int maxNotifications = 50;

  /// Clock injection seam so tests can roll time forward.
  final DateTime Function() _now;

  OwnerCache({
    OwnerCacheStore? store,
    this.cacheTtl = const Duration(hours: 24),
    DateTime Function()? now,
  })  : _store = store ?? SharedPrefsOwnerCacheStore(),
        _now = now ?? DateTime.now;

  // --- key builders ------------------------------------------------------

  String _kpisKey(String orgId) => 'kpis::$orgId';
  String _propertiesKey(String orgId) => 'properties::$orgId';
  String _tenantsKey(String orgId) => 'tenants::$orgId';
  String _notificationsKey(String orgId) => 'notifications::$orgId';

  // --- low-level read/write ---------------------------------------------

  Future<void> _write(String key, Object value) async {
    final payload = jsonEncode({
      'savedAt': _now().toIso8601String(),
      'value': value,
    });
    await _store.writeString(key, payload);
  }

  Future<CachedEntry<T>?> _read<T>(String key, T Function(dynamic) fromJson) async {
    final raw = await _store.readString(key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final savedAt = DateTime.parse(decoded['savedAt'] as String);
      final value = fromJson(decoded['value']);
      final age = _now().difference(savedAt);
      return CachedEntry<T>(
        value: value,
        savedAt: savedAt,
        stale: age > cacheTtl,
      );
    } catch (_) {
      // Corrupted entry — drop it so we stop serving garbage.
      await _store.remove(key);
      return null;
    }
  }

  // --- KPIs --------------------------------------------------------------

  Future<void> cacheKpis(String orgId, Map<String, dynamic> kpis) =>
      _write(_kpisKey(orgId), kpis);

  Future<CachedEntry<Map<String, dynamic>>?> getCachedKpis(String orgId) =>
      _read<Map<String, dynamic>>(
        _kpisKey(orgId),
        (v) => Map<String, dynamic>.from(v as Map),
      );

  // --- properties --------------------------------------------------------

  Future<void> cacheProperties(
    String orgId,
    List<Map<String, dynamic>> properties,
  ) =>
      _write(_propertiesKey(orgId), properties);

  Future<CachedEntry<List<Map<String, dynamic>>>?> getCachedProperties(
    String orgId,
  ) =>
      _read<List<Map<String, dynamic>>>(
        _propertiesKey(orgId),
        (v) => (v as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
      );

  // --- tenants (last 50 MRU) --------------------------------------------

  Future<void> cacheTenants(
    String orgId,
    List<Map<String, dynamic>> tenants,
  ) {
    // Keep only the most-recently-viewed `maxTenants`. Caller is expected
    // to pass them already sorted by recency (most recent first).
    final trimmed =
        tenants.length > maxTenants ? tenants.sublist(0, maxTenants) : tenants;
    return _write(_tenantsKey(orgId), trimmed);
  }

  Future<CachedEntry<List<Map<String, dynamic>>>?> getCachedTenants(
    String orgId,
  ) =>
      _read<List<Map<String, dynamic>>>(
        _tenantsKey(orgId),
        (v) => (v as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
      );

  // --- notifications -----------------------------------------------------

  Future<void> cacheNotifications(
    String orgId,
    List<Map<String, dynamic>> notifications,
  ) {
    final trimmed = notifications.length > maxNotifications
        ? notifications.sublist(0, maxNotifications)
        : notifications;
    return _write(_notificationsKey(orgId), trimmed);
  }

  Future<CachedEntry<List<Map<String, dynamic>>>?> getCachedNotifications(
    String orgId,
  ) =>
      _read<List<Map<String, dynamic>>>(
        _notificationsKey(orgId),
        (v) => (v as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
      );

  // --- lifecycle ---------------------------------------------------------

  /// Wipe every owner-cache entry. Called from AuthProvider.logout so the
  /// next login starts clean.
  Future<void> clearAll() => _store.clear();
}

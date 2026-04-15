import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Lightweight offline cache for owner-surface data. Persists JSON blobs
/// in SharedPreferences keyed by a string. Singleton — initialize once at
/// boot via [OwnerCache.init] before reading/writing.
class OwnerCache {
  OwnerCache._();
  static final OwnerCache instance = OwnerCache._();

  SharedPreferences? _prefs;
  bool _initialized = false;

  bool get isInitialized => _initialized;

  static const _prefix = 'bossnyumba:owner_cache:';

  Future<void> init() async {
    if (_initialized) return;
    _prefs = await SharedPreferences.getInstance();
    _initialized = true;
  }

  void _assertReady() {
    if (!_initialized || _prefs == null) {
      throw StateError(
        'OwnerCache used before init(). Call OwnerCache.instance.init() at boot.',
      );
    }
  }

  Future<void> put(String key, Object value) async {
    _assertReady();
    await _prefs!.setString('$_prefix$key', jsonEncode(value));
  }

  dynamic get(String key) {
    _assertReady();
    final raw = _prefs!.getString('$_prefix$key');
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  Future<void> remove(String key) async {
    _assertReady();
    await _prefs!.remove('$_prefix$key');
  }

  Future<void> clear() async {
    _assertReady();
    final keys = _prefs!.getKeys().where((k) => k.startsWith(_prefix)).toList();
    for (final k in keys) {
      await _prefs!.remove(k);
    }
  }
}

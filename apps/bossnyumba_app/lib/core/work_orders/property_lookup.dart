import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';

/// Minimal property + unit record used by the quick-report picker. We keep
/// the shape small and tolerant so the picker works against whatever flavour
/// the backend currently returns.
class PropertySummary {
  final String id;
  final String name;
  final String? city;
  final List<UnitSummary> units;

  const PropertySummary({
    required this.id,
    required this.name,
    this.city,
    this.units = const [],
  });

  factory PropertySummary.fromJson(Map<String, dynamic> j) {
    final rawUnits = (j['units'] as List?) ?? const [];
    return PropertySummary(
      id: (j['id'] ?? '').toString(),
      name: (j['name'] ?? 'Property').toString(),
      city: j['city'] as String?,
      units: rawUnits
          .whereType<Map<String, dynamic>>()
          .map(UnitSummary.fromJson)
          .toList(),
    );
  }
}

class UnitSummary {
  final String id;
  final String label;

  const UnitSummary({required this.id, required this.label});

  factory UnitSummary.fromJson(Map<String, dynamic> j) => UnitSummary(
        id: (j['id'] ?? '').toString(),
        label: (j['label'] ?? j['name'] ?? j['number'] ?? 'Unit').toString(),
      );
}

/// Repository that backs the property + unit search-as-you-type picker.
///
/// Tries the backend's optional search endpoint first, then falls back to
/// `/properties` with client-side filtering. Tracks the most recently-visited
/// property ids in shared_preferences so the picker can surface them at the
/// top of the list.
class PropertyLookup {
  static const String _recentKey = 'owner.recent_property_ids.v1';
  static const int _recentLimit = 5;

  final ApiClient _api;
  final Future<SharedPreferences> Function() _prefs;

  PropertyLookup({
    ApiClient? api,
    Future<SharedPreferences> Function()? prefs,
  })  : _api = api ?? ApiClient.instance,
        _prefs = prefs ?? SharedPreferences.getInstance;

  Future<List<PropertySummary>> search(String query) async {
    // Try the generic search endpoint first; fall through to /properties.
    if (query.trim().isNotEmpty) {
      final resp = await _api.get<dynamic>(
        '/search/properties',
        queryParams: {'q': query.trim()},
      );
      if (resp.isOk && resp.data != null) {
        final items = _extractItems(resp.data);
        if (items.isNotEmpty) {
          return items.map(PropertySummary.fromJson).toList();
        }
      }
    }
    final resp = await _api.get<dynamic>('/properties');
    if (!resp.isOk || resp.data == null) return const [];
    final items = _extractItems(resp.data)
        .map(PropertySummary.fromJson)
        .toList();
    if (query.trim().isEmpty) return items;
    final q = query.trim().toLowerCase();
    return items
        .where((p) =>
            p.name.toLowerCase().contains(q) ||
            (p.city?.toLowerCase().contains(q) ?? false))
        .toList();
  }

  Future<List<String>> recentIds() async {
    final p = await _prefs();
    return p.getStringList(_recentKey) ?? const <String>[];
  }

  Future<void> markVisited(String propertyId) async {
    if (propertyId.isEmpty) return;
    final p = await _prefs();
    final current = p.getStringList(_recentKey) ?? <String>[];
    current.remove(propertyId);
    current.insert(0, propertyId);
    if (current.length > _recentLimit) {
      current.removeRange(_recentLimit, current.length);
    }
    await p.setStringList(_recentKey, current);
  }

  List<Map<String, dynamic>> _extractItems(dynamic data) {
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    if (data is Map && data['items'] is List) {
      return (data['items'] as List)
          .whereType<Map<String, dynamic>>()
          .toList();
    }
    if (data is String) {
      try {
        final decoded = jsonDecode(data);
        return _extractItems(decoded);
      } catch (_) {
        return const [];
      }
    }
    return const [];
  }
}

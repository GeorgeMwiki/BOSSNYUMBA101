import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// A single entry in the offline upload queue. Stores enough metadata to
/// replay a multipart upload once connectivity is restored.
class QueuedWorkOrder {
  final String localId;
  final String orgId;
  final String propertyId;
  final String? unitId;
  final String category;
  final String priority;
  final String? description;
  final List<String> photoPaths;
  final String? voiceNotePath;
  final Map<String, dynamic>? metadata;
  final DateTime queuedAt;

  const QueuedWorkOrder({
    required this.localId,
    required this.orgId,
    required this.propertyId,
    this.unitId,
    required this.category,
    required this.priority,
    this.description,
    this.photoPaths = const [],
    this.voiceNotePath,
    this.metadata,
    required this.queuedAt,
  });

  Map<String, dynamic> toJson() => {
        'localId': localId,
        'orgId': orgId,
        'propertyId': propertyId,
        if (unitId != null) 'unitId': unitId,
        'category': category,
        'priority': priority,
        if (description != null) 'description': description,
        'photoPaths': photoPaths,
        if (voiceNotePath != null) 'voiceNotePath': voiceNotePath,
        if (metadata != null) 'metadata': metadata,
        'queuedAt': queuedAt.toIso8601String(),
      };

  factory QueuedWorkOrder.fromJson(Map<String, dynamic> j) => QueuedWorkOrder(
        localId: j['localId'] as String,
        orgId: j['orgId'] as String,
        propertyId: j['propertyId'] as String,
        unitId: j['unitId'] as String?,
        category: j['category'] as String,
        priority: j['priority'] as String,
        description: j['description'] as String?,
        photoPaths:
            (j['photoPaths'] as List?)?.map((e) => e.toString()).toList() ??
                const [],
        voiceNotePath: j['voiceNotePath'] as String?,
        metadata: j['metadata'] as Map<String, dynamic>?,
        queuedAt: DateTime.tryParse(j['queuedAt'] as String? ?? '') ??
            DateTime.now(),
      );
}

/// Persists pending work-order uploads via `shared_preferences` so they can be
/// replayed at app start after a crash/network failure. Hive was considered
/// but the app does not currently depend on it; `shared_preferences` is
/// already present.
class WorkOrderQueue {
  static const String _key = 'owner.work_order_queue.v1';

  /// Hook a preferences instance for tests.
  final Future<SharedPreferences> Function() _prefs;

  WorkOrderQueue({Future<SharedPreferences> Function()? prefs})
      : _prefs = prefs ?? SharedPreferences.getInstance;

  Future<List<QueuedWorkOrder>> list() async {
    final p = await _prefs();
    final raw = p.getStringList(_key) ?? const <String>[];
    final out = <QueuedWorkOrder>[];
    for (final s in raw) {
      try {
        out.add(QueuedWorkOrder.fromJson(
            jsonDecode(s) as Map<String, dynamic>));
      } catch (_) {
        // Skip malformed entries so a single bad write cannot wedge the queue.
      }
    }
    return out;
  }

  Future<int> count() async => (await list()).length;

  Future<void> enqueue(QueuedWorkOrder entry) async {
    final p = await _prefs();
    final raw = p.getStringList(_key) ?? <String>[];
    raw.add(jsonEncode(entry.toJson()));
    await p.setStringList(_key, raw);
  }

  Future<void> remove(String localId) async {
    final p = await _prefs();
    final raw = p.getStringList(_key) ?? <String>[];
    raw.removeWhere((s) {
      try {
        final m = jsonDecode(s) as Map<String, dynamic>;
        return m['localId'] == localId;
      } catch (_) {
        return false;
      }
    });
    await p.setStringList(_key, raw);
  }

  Future<void> clear() async {
    final p = await _prefs();
    await p.remove(_key);
  }
}

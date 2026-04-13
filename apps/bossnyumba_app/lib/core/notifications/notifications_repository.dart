import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';

/// Types surfaced in the owner inbox. Mirrors backend taxonomy so callers
/// can render per-type icons without downstream mapping.
enum NotificationType {
  approval,
  invoice,
  workOrder,
  tenantAlert,
  payment,
  system,
  unknown,
}

NotificationType notificationTypeFromString(String? raw) {
  switch (raw?.toLowerCase()) {
    case 'approval':
    case 'approval_request':
      return NotificationType.approval;
    case 'invoice':
    case 'invoice_overdue':
      return NotificationType.invoice;
    case 'work_order':
    case 'work_order_urgent':
      return NotificationType.workOrder;
    case 'tenant':
    case 'tenant_alert':
      return NotificationType.tenantAlert;
    case 'payment':
      return NotificationType.payment;
    case 'system':
      return NotificationType.system;
    default:
      return NotificationType.unknown;
  }
}

/// Severity used to power the "Critical" tab in the inbox and the home
/// dashboard "Recent alerts" callout.
enum NotificationSeverity { info, warning, critical }

NotificationSeverity severityFromString(String? raw) {
  switch (raw?.toLowerCase()) {
    case 'critical':
    case 'urgent':
      return NotificationSeverity.critical;
    case 'warning':
    case 'warn':
      return NotificationSeverity.warning;
    default:
      return NotificationSeverity.info;
  }
}

@immutable
class OwnerNotification {
  final String id;
  final String title;
  final String body;
  final NotificationType type;
  final NotificationSeverity severity;
  final DateTime createdAt;
  final bool read;
  final String? deepLink;
  final Map<String, dynamic> data;

  const OwnerNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.severity,
    required this.createdAt,
    required this.read,
    this.deepLink,
    this.data = const {},
  });

  OwnerNotification copyWith({bool? read}) => OwnerNotification(
        id: id,
        title: title,
        body: body,
        type: type,
        severity: severity,
        createdAt: createdAt,
        read: read ?? this.read,
        deepLink: deepLink,
        data: data,
      );

  factory OwnerNotification.fromJson(Map<String, dynamic> json) {
    return OwnerNotification(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] as String?) ?? '',
      body: (json['body'] ?? json['message'] ?? '').toString(),
      type: notificationTypeFromString(json['type'] as String?),
      severity: severityFromString(json['severity'] as String?),
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString())
              ?.toLocal() ??
          DateTime.now(),
      read: (json['read'] as bool?) ??
          (json['isRead'] as bool?) ??
          (json['status'] == 'read'),
      deepLink: json['deepLink'] as String?,
      data: (json['data'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'body': body,
        'type': type.name,
        'severity': severity.name,
        'createdAt': createdAt.toIso8601String(),
        'read': read,
        if (deepLink != null) 'deepLink': deepLink,
        'data': data,
      };
}

/// In-memory + on-disk cache backed by `shared_preferences`. We would prefer
/// Hive for the richer typed API but Hive isn't in `pubspec.yaml` yet — see
/// agent report. `shared_preferences` is already a dependency and works
/// identically for this footprint.
class NotificationsRepository extends ChangeNotifier {
  static const _cacheKey = 'bn_owner_notifications_cache_v1';

  final ApiClient _api;
  List<OwnerNotification> _items = const [];
  bool _loading = false;
  String? _error;

  NotificationsRepository({ApiClient? api}) : _api = api ?? ApiClient.instance;

  List<OwnerNotification> get items => List.unmodifiable(_items);
  bool get isLoading => _loading;
  String? get error => _error;

  int get unreadCount => _items.where((n) => !n.read).length;
  int get criticalCount =>
      _items.where((n) => n.severity == NotificationSeverity.critical).length;

  List<OwnerNotification> filter(NotificationsFilter filter) {
    switch (filter) {
      case NotificationsFilter.all:
        return items;
      case NotificationsFilter.unread:
        return items.where((n) => !n.read).toList(growable: false);
      case NotificationsFilter.critical:
        return items
            .where((n) => n.severity == NotificationSeverity.critical)
            .toList(growable: false);
    }
  }

  // ---- Network ------------------------------------------------------------

  /// Fetches the owner's notifications list. On failure we keep whatever is
  /// currently in memory (or hydrate from the on-disk cache on first call)
  /// so offline users still see something useful while commuting.
  Future<void> refresh() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final resp = await _api.get<dynamic>('/api/v1/notifications');
      if (!resp.isOk) {
        _error = resp.error;
        if (_items.isEmpty) await _hydrateFromCache();
        return;
      }
      final data = resp.data;
      final list = _coerceList(data);
      _items = list
          .whereType<Map>()
          .map((e) => OwnerNotification.fromJson(e.cast<String, dynamic>()))
          .toList(growable: false);
      await _persistCache();
    } catch (e) {
      _error = e.toString();
      if (_items.isEmpty) await _hydrateFromCache();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<OwnerNotification?> getById(String id) async {
    // Serve from memory first — the detail screen is reached via deep link
    // after a refresh() in most flows.
    final local = _items.firstWhere(
      (n) => n.id == id,
      orElse: () => _sentinel,
    );
    if (!identical(local, _sentinel)) return local;

    final resp = await _api.get<Map<String, dynamic>>('/api/v1/notifications/$id');
    if (!resp.isOk || resp.data == null) return null;
    final parsed = OwnerNotification.fromJson(resp.data!);
    // Merge into local list so subsequent taps are instant.
    _items = [parsed, ..._items.where((n) => n.id != id)];
    notifyListeners();
    return parsed;
  }

  Future<bool> markRead(String id) async {
    final resp = await _api.patch<Map<String, dynamic>>(
      '/api/v1/notifications/$id/read',
      body: const {'read': true},
    );
    if (!resp.isOk) return false;
    _items = _items
        .map((n) => n.id == id ? n.copyWith(read: true) : n)
        .toList(growable: false);
    await _persistCache();
    notifyListeners();
    return true;
  }

  Future<bool> markAllRead() async {
    final resp = await _api.post<Map<String, dynamic>>(
      '/api/v1/notifications/read-all',
    );
    if (!resp.isOk) return false;
    _items = _items.map((n) => n.copyWith(read: true)).toList(growable: false);
    await _persistCache();
    notifyListeners();
    return true;
  }

  /// Locally apply a push that arrived in the foreground. Does NOT hit the
  /// server — the server-side record already exists by definition (push only
  /// fires after the record is written).
  void upsertLocal(OwnerNotification notification) {
    _items = [
      notification,
      ..._items.where((n) => n.id != notification.id),
    ];
    notifyListeners();
    // Fire and forget — cache write is best-effort.
    // ignore: discarded_futures
    _persistCache();
  }

  // ---- Cache --------------------------------------------------------------

  Future<void> _persistCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _cacheKey,
        jsonEncode(_items.map((n) => n.toJson()).toList()),
      );
    } catch (e) {
      debugPrint('NotificationsRepository cache write failed: $e');
    }
  }

  Future<void> _hydrateFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      _items = decoded
          .whereType<Map>()
          .map((e) => OwnerNotification.fromJson(e.cast<String, dynamic>()))
          .toList(growable: false);
    } catch (e) {
      debugPrint('NotificationsRepository cache read failed: $e');
    }
  }

  @visibleForTesting
  Future<void> hydrateFromCacheForTest() => _hydrateFromCache();

  // ---- Helpers ------------------------------------------------------------

  List<dynamic> _coerceList(dynamic data) {
    if (data is List) return data;
    if (data is Map) {
      if (data['items'] is List) return data['items'] as List;
      if (data['notifications'] is List) {
        return data['notifications'] as List;
      }
      if (data['data'] is List) return data['data'] as List;
    }
    return const [];
  }

  static final OwnerNotification _sentinel = OwnerNotification(
    id: '__sentinel__',
    title: '',
    body: '',
    type: NotificationType.unknown,
    severity: NotificationSeverity.info,
    createdAt: DateTime.fromMillisecondsSinceEpoch(0),
    read: true,
  );
}

enum NotificationsFilter { all, unread, critical }

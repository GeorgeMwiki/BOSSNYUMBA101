// Notifications repository for the owner mobile companion.
//
// Wraps `/api/v1/notifications` and provides an offline-friendly local
// cache via `shared_preferences`. When `hive` is added to pubspec.yaml
// this can be swapped for a Hive box keyed by `notificationId` with
// zero caller impact — the public surface returns plain models.

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';

/// Severity / priority for a notification. Used by the inbox to show
/// the "Critical" tab and for per-row iconography.
enum NotificationSeverity { info, warning, critical }

NotificationSeverity _severityFromString(String? s) {
  switch (s?.toLowerCase()) {
    case 'critical':
    case 'urgent':
    case 'high':
      return NotificationSeverity.critical;
    case 'warning':
    case 'warn':
    case 'medium':
      return NotificationSeverity.warning;
    default:
      return NotificationSeverity.info;
  }
}

String _severityToString(NotificationSeverity s) {
  switch (s) {
    case NotificationSeverity.critical:
      return 'critical';
    case NotificationSeverity.warning:
      return 'warning';
    case NotificationSeverity.info:
      return 'info';
  }
}

/// Plain value object representing a single notification row.
class NotificationModel {
  final String id;
  final String title;
  final String body;
  final String type;
  final NotificationSeverity severity;
  final bool read;
  final DateTime createdAt;
  final Map<String, dynamic> data;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.severity,
    required this.read,
    required this.createdAt,
    this.data = const {},
  });

  NotificationModel copyWith({bool? read}) => NotificationModel(
        id: id,
        title: title,
        body: body,
        type: type,
        severity: severity,
        read: read ?? this.read,
        createdAt: createdAt,
        data: data,
      );

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] ?? json['subject'] ?? '').toString(),
      body: (json['body'] ?? json['message'] ?? '').toString(),
      type: (json['type'] ?? 'notification').toString(),
      severity: _severityFromString(
        (json['severity'] ?? json['priority'])?.toString(),
      ),
      read: (json['read'] ?? json['isRead'] ?? false) as bool,
      createdAt: DateTime.tryParse(
            (json['createdAt'] ?? json['created_at'] ?? '').toString(),
          ) ??
          DateTime.now(),
      data: Map<String, dynamic>.from(json['data'] as Map? ?? const {}),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'body': body,
        'type': type,
        'severity': _severityToString(severity),
        'read': read,
        'createdAt': createdAt.toIso8601String(),
        'data': data,
      };

  /// Derive a deep link path from the notification's data bag. Mirrors
  /// the rules used by [PushService.parseDeepLink] so that taps on
  /// push and taps in the inbox agree.
  String deepLinkPath() {
    final bagType = (data['type'] ?? type).toString().toLowerCase();
    final bagId = (data['id'] ?? data['entityId'])?.toString();

    switch (bagType) {
      case 'invoice':
      case 'invoice_approval':
      case 'approval':
        if (bagId != null) return '/owner/approvals/$bagId';
        break;
      case 'work_order':
        if (bagId != null) return '/owner/work-orders/$bagId';
        break;
      case 'tenant':
        if (bagId != null) return '/owner/tenants/$bagId';
        break;
    }
    return '/owner/notifications/$id';
  }
}

/// Repository that wraps `/notifications` and caches results locally.
class NotificationsRepository {
  NotificationsRepository({ApiClient? api, SharedPreferences? prefs})
      : _api = api ?? ApiClient.instance,
        _prefsOverride = prefs;

  final ApiClient _api;
  final SharedPreferences? _prefsOverride;

  static const _cacheKey = 'notifications_cache_v1';
  static const _unreadBadgeKey = 'push_inbox_badge';

  Future<SharedPreferences> _prefs() async =>
      _prefsOverride ?? await SharedPreferences.getInstance();

  /// Fetch the paginated list of notifications. On success writes the
  /// result to the local cache. On failure returns the cached copy.
  Future<List<NotificationModel>> list({
    int limit = 50,
    bool unreadOnly = false,
  }) async {
    final query = <String, String>{
      'limit': '$limit',
      if (unreadOnly) 'unread': 'true',
    };
    final resp = await _api.get<dynamic>('/notifications', queryParams: query);
    if (resp.isOk && resp.data != null) {
      final raw = resp.data;
      final List<dynamic> items = raw is List
          ? raw
          : (raw is Map && raw['items'] is List
              ? List<dynamic>.from(raw['items'] as List)
              : <dynamic>[]);
      final models = items
          .whereType<Map<String, dynamic>>()
          .map(NotificationModel.fromJson)
          .toList();
      await _writeCache(models);
      return models;
    }
    return _readCache();
  }

  /// Fetch a single notification by id. Falls back to the cached copy
  /// if the network call fails.
  Future<NotificationModel?> getById(String id) async {
    final resp = await _api.get<dynamic>('/notifications/$id');
    if (resp.isOk && resp.data != null) {
      final data = resp.data;
      if (data is Map<String, dynamic>) {
        return NotificationModel.fromJson(data);
      }
    }
    final cached = await _readCache();
    for (final n in cached) {
      if (n.id == id) return n;
    }
    return null;
  }

  /// Mark a single notification as read and update the local cache.
  Future<bool> markRead(String id) async {
    final resp = await _api.patch<dynamic>(
      '/notifications/$id',
      body: {'read': true},
    );
    if (resp.isOk) {
      await _updateCache((n) => n.id == id ? n.copyWith(read: true) : n);
      await _decrementBadge();
      return true;
    }
    return false;
  }

  /// Mark every notification in the inbox as read.
  Future<bool> markAllRead() async {
    final resp = await _api.post<dynamic>('/notifications/mark-all-read');
    if (resp.isOk) {
      await _updateCache((n) => n.copyWith(read: true));
      final prefs = await _prefs();
      await prefs.setInt(_unreadBadgeKey, 0);
      return true;
    }
    return false;
  }

  /// Current unread badge count (shared with [PushService]).
  Future<int> unreadBadge() async {
    final prefs = await _prefs();
    return prefs.getInt(_unreadBadgeKey) ?? 0;
  }

  // ----- cache helpers ----------------------------------------------------

  Future<void> _writeCache(List<NotificationModel> items) async {
    final prefs = await _prefs();
    final encoded = items.map((n) => jsonEncode(n.toJson())).toList();
    await prefs.setStringList(_cacheKey, encoded);
    final unread = items.where((n) => !n.read).length;
    await prefs.setInt(_unreadBadgeKey, unread);
  }

  Future<List<NotificationModel>> _readCache() async {
    final prefs = await _prefs();
    final raw = prefs.getStringList(_cacheKey) ?? <String>[];
    final out = <NotificationModel>[];
    for (final line in raw) {
      try {
        final map = jsonDecode(line) as Map<String, dynamic>;
        out.add(NotificationModel.fromJson(map));
      } catch (_) {
        // Skip corrupted entries.
      }
    }
    return out;
  }

  Future<void> _updateCache(
    NotificationModel Function(NotificationModel) mapper,
  ) async {
    final items = await _readCache();
    final updated = items.map(mapper).toList();
    await _writeCache(updated);
  }

  Future<void> _decrementBadge() async {
    final prefs = await _prefs();
    final current = prefs.getInt(_unreadBadgeKey) ?? 0;
    await prefs.setInt(_unreadBadgeKey, current > 0 ? current - 1 : 0);
  }
}

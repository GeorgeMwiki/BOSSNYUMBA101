<<<<<<< HEAD
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
=======
// Notifications repository for the owner mobile companion.
//
// Wraps `/api/v1/notifications` and provides an offline-friendly local
// cache via `shared_preferences`. When `hive` is added to pubspec.yaml
// this can be swapped for a Hive box keyed by `notificationId` with
// zero caller impact — the public surface returns plain models.

import 'dart:convert';

>>>>>>> worktree-agent-a46293cc
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';

<<<<<<< HEAD
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
=======
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
>>>>>>> worktree-agent-a46293cc
      return NotificationSeverity.warning;
    default:
      return NotificationSeverity.info;
  }
}

<<<<<<< HEAD
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
=======
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
>>>>>>> worktree-agent-a46293cc
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.severity,
<<<<<<< HEAD
    required this.createdAt,
    required this.read,
    this.deepLink,
    this.data = const {},
  });

  OwnerNotification copyWith({bool? read}) => OwnerNotification(
=======
    required this.read,
    required this.createdAt,
    this.data = const {},
  });

  NotificationModel copyWith({bool? read}) => NotificationModel(
>>>>>>> worktree-agent-a46293cc
        id: id,
        title: title,
        body: body,
        type: type,
        severity: severity,
<<<<<<< HEAD
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
=======
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
>>>>>>> worktree-agent-a46293cc
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'body': body,
<<<<<<< HEAD
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
=======
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
>>>>>>> worktree-agent-a46293cc

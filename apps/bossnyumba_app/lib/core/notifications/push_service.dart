import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';

// NOTE ON EXTERNAL DEPS:
// This service is architected to wrap `firebase_messaging`, but that package
// is intentionally NOT yet declared in `pubspec.yaml` (see agent report). To
// let the rest of the app compile and be unit-testable today, we define a
// lightweight [RemoteMessage] value type that mirrors the FCM shape
// (`messageId`, `data`, `notification`). When `firebase_messaging` is added
// later, swap the imports in [_FirebaseMessagingAdapter] without touching
// callers of [PushService].
//
// Any call into a yet-to-be-wired FCM method is guarded with try/catch so the
// app boots cleanly on devices where native plumbing is absent (e.g. unit
// tests, web, or a dev build that hasn't set up GoogleService-Info.plist).

/// In-app representation of an FCM payload. Mirrors the subset of fields we
/// care about from `firebase_messaging.RemoteMessage`.
@immutable
class RemoteMessage {
  final String? messageId;
  final DateTime? sentTime;
  final Map<String, dynamic> data;
  final RemoteNotification? notification;

  const RemoteMessage({
    this.messageId,
    this.sentTime,
    this.data = const {},
    this.notification,
  });

  factory RemoteMessage.fromJson(Map<String, dynamic> json) {
    final notifRaw = json['notification'];
    return RemoteMessage(
      messageId: json['messageId'] as String?,
      sentTime: json['sentTime'] is String
          ? DateTime.tryParse(json['sentTime'] as String)
          : null,
      data: (json['data'] as Map?)?.cast<String, dynamic>() ?? const {},
      notification: notifRaw is Map
          ? RemoteNotification(
              title: notifRaw['title'] as String?,
              body: notifRaw['body'] as String?,
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        if (messageId != null) 'messageId': messageId,
        if (sentTime != null) 'sentTime': sentTime!.toIso8601String(),
        'data': data,
        if (notification != null)
          'notification': {
            'title': notification!.title,
            'body': notification!.body,
          },
      };
}

@immutable
class RemoteNotification {
  final String? title;
  final String? body;
  const RemoteNotification({this.title, this.body});
}

/// Top-level background handler. Must be a top-level or static function so
/// the Flutter engine can re-invoke it in an isolate when the app is backgrounded.
/// When `firebase_messaging` is wired up, register this via
/// `FirebaseMessaging.onBackgroundMessage(handleBackgroundMessage)` inside
/// `main.dart` (a parallel task).
Future<void> handleBackgroundMessage(RemoteMessage message) async {
  // Persist to local cache so the inbox is warm the moment the user opens
  // the app, even before the network fetch completes.
  try {
    final prefs = await SharedPreferences.getInstance();
    const key = 'bn_notifications_inbox_cache_v1';
    final existing = prefs.getString(key);
    final List<dynamic> list = existing == null
        ? <dynamic>[]
        : (jsonDecode(existing) as List<dynamic>);
    list.insert(0, message.toJson());
    // Keep the cache bounded — mobile companion only cares about recent.
    if (list.length > 100) list.removeRange(100, list.length);
    await prefs.setString(key, jsonEncode(list));
    await prefs.setInt('bn_notifications_badge',
        (prefs.getInt('bn_notifications_badge') ?? 0) + 1);
  } catch (e) {
    debugPrint('handleBackgroundMessage cache failed: $e');
  }
}

/// Service abstraction over FCM. Consumers shouldn't import
/// `firebase_messaging` directly — go through here so swapping to another
/// transport (APNs direct, OneSignal, etc.) is a single-file change.
class PushService {
  static PushService? _instance;
  static PushService get instance => _instance ??= PushService(ApiClient.instance);

  final ApiClient _api;
  final StreamController<RemoteMessage> _foregroundController =
      StreamController<RemoteMessage>.broadcast();

  String? _token;
  bool _initialized = false;

  PushService(this._api);

  /// Expose the raw platform messaging adapter for tests to inject a fake.
  @visibleForTesting
  PushMessagingAdapter? adapterOverride;

  PushMessagingAdapter get _adapter =>
      adapterOverride ?? _FirebaseMessagingAdapter();

  /// Latest resolved FCM registration token. Null until [initialize] succeeds.
  String? get fcmToken => _token;

  /// Incoming messages while the app is in the foreground.
  Stream<RemoteMessage> get foregroundMessages => _foregroundController.stream;

  /// Request notification permission, fetch the FCM token, and register it
  /// with the backend. Safe to call multiple times — second and later calls
  /// refresh the token and re-register only if it changed.
  Future<void> initialize({required String userId, String? platform}) async {
    try {
      final granted = await _adapter.requestPermission();
      if (!granted) {
        debugPrint('Push permission denied — running without notifications');
        return;
      }
      final token = await _adapter.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('FCM returned a null/empty token');
        return;
      }
      if (_token == token && _initialized) return;
      _token = token;

      _adapter.onForegroundMessage.listen(_foregroundController.add);

      await _api.post<Map<String, dynamic>>(
        '/api/v1/devices/register',
        body: {
          'token': token,
          'platform': platform ?? defaultTargetPlatform.name,
          'userId': userId,
        },
      );
      _initialized = true;
    } catch (e) {
      // Never crash the app if push init fails — the user should still be
      // able to use the companion for read-only views.
      debugPrint('PushService.initialize failed: $e');
    }
  }

  /// Unregister the current device token from the backend. Called on logout
  /// so the user stops receiving push for a device they're no longer on.
  Future<void> unregister() async {
    final t = _token;
    _token = null;
    _initialized = false;
    if (t == null || t.isEmpty) return;
    try {
      await _api.post<Map<String, dynamic>>(
        '/api/v1/devices/unregister',
        body: {'token': t},
      );
      await _adapter.deleteToken();
    } catch (e) {
      debugPrint('PushService.unregister failed: $e');
    }
  }

  /// Extract a deep-link route from an incoming [RemoteMessage].
  ///
  /// Contract with the backend push payload:
  /// - `data.type`            — one of `notification|approval|invoice|work_order|tenant`
  /// - `data.id`              — resource id
  /// - `data.notificationId`  — fallback id (always present on Owner-targeted pushes)
  ///
  /// Falls back to `/owner/notifications` when nothing matches so the inbox
  /// always receives the tap — but ideally owners land directly on the detail
  /// screen (mobile companion = "stay informed while commuting" UX).
  static String deepLinkFor(RemoteMessage message) {
    final data = message.data;
    final type = (data['type'] ?? data['category'])?.toString();
    final id = (data['id'] ??
            data['resourceId'] ??
            data['notificationId'])
        ?.toString();

    if (id == null || id.isEmpty) return '/owner/notifications';

    switch (type) {
      case 'approval':
      case 'approval_request':
        return '/owner/approvals/$id';
      case 'invoice':
      case 'invoice_overdue':
        return '/owner/invoices/$id';
      case 'work_order':
      case 'work_order_urgent':
        return '/owner/work-orders/$id';
      case 'tenant':
      case 'tenant_alert':
        return '/owner/tenants/$id';
      case 'payment':
        return '/owner/payments/$id';
      case 'notification':
      default:
        return '/owner/notifications/$id';
    }
  }

  Future<void> dispose() async {
    await _foregroundController.close();
  }
}

// ---------------------------------------------------------------------------
// Adapter layer
// ---------------------------------------------------------------------------

/// Thin interface abstracting the platform messaging layer so tests can
/// inject a fake without pulling in `firebase_messaging`.
abstract class PushMessagingAdapter {
  Future<bool> requestPermission();
  Future<String?> getToken();
  Future<void> deleteToken();
  Stream<RemoteMessage> get onForegroundMessage;
}

/// Production adapter. Will delegate to `firebase_messaging` once that
/// dependency lands in `pubspec.yaml`. Today every method is a safe no-op so
/// the app still boots on devices that haven't been configured.
class _FirebaseMessagingAdapter implements PushMessagingAdapter {
  final StreamController<RemoteMessage> _controller =
      StreamController<RemoteMessage>.broadcast();

  @override
  Future<bool> requestPermission() async {
    try {
      // TODO(push): swap to:
      //   final settings = await FirebaseMessaging.instance.requestPermission();
      //   return settings.authorizationStatus == AuthorizationStatus.authorized;
      return false;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<String?> getToken() async {
    try {
      // TODO(push): return FirebaseMessaging.instance.getToken();
      return null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> deleteToken() async {
    try {
      // TODO(push): await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  @override
  Stream<RemoteMessage> get onForegroundMessage {
    // TODO(push): bridge FirebaseMessaging.onMessage into this stream.
    return _controller.stream;
  }
}

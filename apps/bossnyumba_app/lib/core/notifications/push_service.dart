// Push notifications service for the owner mobile companion.
//
// This service is designed to wrap `firebase_messaging` when that dependency
// is available. Because the dependency is NOT yet listed in pubspec.yaml
// (see app report), we expose a minimal, dependency-free surface that uses
// a `RemoteMessage` shim. When `firebase_messaging` is added, swap the
// `RemoteMessage` typedef to `firebase_messaging.RemoteMessage` and
// replace the stubbed `_FirebasePlatform` bindings — the public API of
// [PushService] is deliberately stable.
//
// iOS note: APNs entitlements + APNs key upload to Firebase console are
// still required at the native level before this service will actually
// deliver remote pushes on iOS builds.

import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';

/// Minimal, platform-agnostic representation of a remote push message.
///
/// Mirrors the shape of `firebase_messaging`'s `RemoteMessage` so swapping
/// to the real dep is a near-noop on callers.
class RemoteMessage {
  final String? messageId;
  final RemoteNotification? notification;
  final Map<String, dynamic> data;
  final DateTime? sentTime;

  const RemoteMessage({
    this.messageId,
    this.notification,
    this.data = const {},
    this.sentTime,
  });

  Map<String, dynamic> toJson() => {
        'messageId': messageId,
        'title': notification?.title,
        'body': notification?.body,
        'data': data,
        'sentTime': sentTime?.toIso8601String(),
      };

  factory RemoteMessage.fromJson(Map<String, dynamic> json) => RemoteMessage(
        messageId: json['messageId'] as String?,
        notification: (json['title'] != null || json['body'] != null)
            ? RemoteNotification(
                title: json['title'] as String?,
                body: json['body'] as String?,
              )
            : null,
        data: Map<String, dynamic>.from(json['data'] as Map? ?? const {}),
        sentTime: json['sentTime'] != null
            ? DateTime.tryParse(json['sentTime'] as String)
            : null,
      );
}

class RemoteNotification {
  final String? title;
  final String? body;
  const RemoteNotification({this.title, this.body});
}

/// Top-level background message handler. Must be a top-level (or static)
/// function when migrated to the real `firebase_messaging` plugin, since
/// it is invoked in a separate isolate.
Future<void> handleBackgroundMessage(RemoteMessage message) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList('push_inbox_offline') ?? <String>[];
    raw.insert(0, jsonEncode(message.toJson()));
    // Cap offline queue to the latest 200 entries.
    if (raw.length > 200) {
      raw.removeRange(200, raw.length);
    }
    await prefs.setStringList('push_inbox_offline', raw);

    final badge = (prefs.getInt('push_inbox_badge') ?? 0) + 1;
    await prefs.setInt('push_inbox_badge', badge);
  } catch (_) {
    // Background isolate — swallow to keep handler robust.
  }
}

/// Service abstraction over FCM. Safe to instantiate when
/// `firebase_messaging` is not yet wired — calls simply no-op with
/// debug-friendly logging instead of crashing the app.
class PushService {
  PushService({ApiClient? api}) : _api = api ?? ApiClient.instance;

  final ApiClient _api;
  final StreamController<RemoteMessage> _foreground =
      StreamController<RemoteMessage>.broadcast();

  String? _token;
  bool _initialized = false;
  String? _registeredUserId;

  /// The last known FCM token, if any.
  String? get token => _token;

  /// Whether [initialize] has successfully completed once.
  bool get isInitialized => _initialized;

  /// Stream of messages that arrive while the app is in the foreground.
  Stream<RemoteMessage> get foregroundMessages => _foreground.stream;

  /// Request notification permissions, acquire an FCM token, register it
  /// with the backend, and begin listening for foreground messages.
  ///
  /// Safe to call multiple times — subsequent calls are no-ops.
  Future<void> initialize({required String userId, String platform = 'unknown'}) async {
    if (_initialized && _registeredUserId == userId) return;

    try {
      // Permission + token acquisition would normally be done via
      // `FirebaseMessaging.instance.requestPermission()` and
      // `FirebaseMessaging.instance.getToken()`. Kept as a stub here so
      // code compiles without the dep.
      _token ??= await _fetchTokenFromPlatform();

      if (_token != null) {
        await _registerWithBackend(
          token: _token!,
          userId: userId,
          platform: platform,
        );
      }

      _initialized = true;
      _registeredUserId = userId;
    } catch (e) {
      // Silently disable — mobile companion still works via polling.
      _initialized = false;
    }
  }

  /// Push a message through the foreground stream. Normally called by
  /// the `FirebaseMessaging.onMessage` listener — exposed for tests and
  /// for the future wiring layer.
  void dispatchForeground(RemoteMessage message) {
    if (_foreground.isClosed) return;
    _foreground.add(message);
  }

  /// Tear down the token registration on logout.
  Future<void> unregister() async {
    try {
      if (_token != null) {
        await _api.post<dynamic>(
          '/devices/unregister',
          body: {'token': _token},
        );
      }
    } catch (_) {
      // Best-effort.
    } finally {
      _token = null;
      _initialized = false;
      _registeredUserId = null;
    }
  }

  /// Dispose the underlying stream. Should be called when the app is
  /// shutting down (rarely relevant for a mobile runtime).
  Future<void> dispose() async {
    await _foreground.close();
  }

  /// Parse a deep link from a push payload. Returns a route path suitable
  /// for `context.go(...)` or `null` if no deep link can be inferred.
  ///
  /// Payload contract (backend-side):
  ///   data: {
  ///     "type": "invoice|work_order|approval|tenant|notification",
  ///     "id": "<entity id>",
  ///     "notificationId": "<optional server-side notification id>"
  ///   }
  String? parseDeepLink(RemoteMessage message) {
    final data = message.data;
    if (data.isEmpty) return null;
    final type = (data['type'] ?? data['category'])?.toString().toLowerCase();
    final id = (data['id'] ?? data['entityId'])?.toString();
    final notificationId = data['notificationId']?.toString();

    switch (type) {
      case 'invoice':
      case 'invoice_approval':
        if (id != null) return '/owner/approvals/$id';
        break;
      case 'work_order':
        if (id != null) return '/owner/work-orders/$id';
        break;
      case 'tenant':
        if (id != null) return '/owner/tenants/$id';
        break;
      case 'approval':
        if (id != null) return '/owner/approvals/$id';
        break;
      case 'notification':
      default:
        if (notificationId != null) {
          return '/owner/notifications/$notificationId';
        }
        if (id != null) return '/owner/notifications/$id';
    }

    if (notificationId != null) {
      return '/owner/notifications/$notificationId';
    }
    return null;
  }

  // ----- internals --------------------------------------------------------

  Future<String?> _fetchTokenFromPlatform() async {
    // When `firebase_messaging` is available:
    //   return FirebaseMessaging.instance.getToken();
    // For now we return null so the rest of the pipeline degrades cleanly.
    return null;
  }

  Future<void> _registerWithBackend({
    required String token,
    required String userId,
    required String platform,
  }) async {
    await _api.post<dynamic>(
      '/devices/register',
      body: {
        'token': token,
        'platform': platform,
        'userId': userId,
      },
    );
  }
}

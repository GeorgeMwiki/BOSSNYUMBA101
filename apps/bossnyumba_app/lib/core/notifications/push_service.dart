import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../api_client.dart';
import '../api_config.dart';

/// Global navigator key — wired into the app's MaterialApp/GoRouter so that
/// notification taps can navigate without a BuildContext.
final GlobalKey<NavigatorState> pushNavigatorKey = GlobalKey<NavigatorState>();

/// Background isolate handler. Per Firebase Messaging requirements this
/// MUST be a top-level (or static) function — it is invoked in a separate
/// isolate, so it cannot capture instance state.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // The background isolate has no Firebase app yet — initialise defensively.
  try {
    await Firebase.initializeApp();
  } catch (e) {
    if (kDebugMode) {
      debugPrint('[PushService.bg] Firebase.initializeApp failed: $e');
    }
  }
  if (kDebugMode) {
    debugPrint('[PushService.bg] message id=${message.messageId} '
        'data=${message.data}');
  }
}

/// Real Firebase Cloud Messaging integration.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _initialized = false;
  bool _firebaseAvailable = false;
  String? _token;
  String? _userId;

  bool get isInitialized => _initialized;
  String? get currentToken => _token;

  /// Called AFTER the user authenticates. Idempotent.
  Future<void> initialize({String? userId}) async {
    if (_initialized) return;
    _initialized = true;
    _userId = userId;

    // Guard Firebase init so the app still runs without google-services.json
    // (e.g. local dev / web without a config). We log + bail gracefully.
    try {
      await Firebase.initializeApp();
      _firebaseAvailable = true;
    } catch (e) {
      _firebaseAvailable = false;
      debugPrint('[PushService] Firebase not configured — push disabled. ($e)');
      return;
    }

    final messaging = FirebaseMessaging.instance;

    // iOS / web permission prompt. Android <13 returns authorized by default.
    try {
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (kDebugMode) {
        debugPrint('[PushService] permission=${settings.authorizationStatus}');
      }
    } catch (e) {
      debugPrint('[PushService] requestPermission failed: $e');
    }

    // Background handler must be registered before any awaited token fetch.
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Fetch the device token and register it server-side.
    try {
      _token = await messaging.getToken();
      if (kDebugMode) {
        debugPrint('[PushService] token=${_token?.substring(0, 12)}…');
      }
      if (_token != null) {
        await _registerDevice(_token!);
      }
    } catch (e) {
      debugPrint('[PushService] getToken failed: $e');
    }

    // Token rotation.
    messaging.onTokenRefresh.listen((newToken) async {
      _token = newToken;
      if (kDebugMode) debugPrint('[PushService] token refreshed');
      await _registerDevice(newToken);
    });

    // Foreground messages → in-app banner.
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // App opened from a background notification tap.
    FirebaseMessaging.onMessageOpenedApp.listen(_onOpenedApp);

    // Cold-start tap (app was terminated).
    try {
      final initial = await messaging.getInitialMessage();
      if (initial != null) {
        // Defer to next frame so the navigator is mounted.
        WidgetsBinding.instance.addPostFrameCallback((_) => _onOpenedApp(initial));
      }
    } catch (e) {
      debugPrint('[PushService] getInitialMessage failed: $e');
    }
  }

  /// Tear down state on logout. Clears the device token server-side (best
  /// effort) and resets the initialized flag so re-login re-registers.
  Future<void> reset() async {
    final tokenToClear = _token;
    if (tokenToClear != null) {
      try {
        final uri = Uri.parse('${ApiConfig.baseUrl}/users/me/devices/$tokenToClear');
        final headers = ApiClient.instance.authHeaders();
        final resp = await http
            .delete(uri, headers: headers)
            .timeout(const Duration(seconds: 10));
        if (resp.statusCode >= 400) {
          debugPrint('[PushService] device unregister returned ${resp.statusCode}');
        }
      } catch (e) {
        // Endpoint may not be wired yet — log only.
        debugPrint('[PushService] device unregister failed: $e');
      }
    }

    if (_firebaseAvailable) {
      try {
        await FirebaseMessaging.instance.deleteToken();
      } catch (e) {
        debugPrint('[PushService] deleteToken failed: $e');
      }
    }

    _token = null;
    _userId = null;
    _initialized = false;
    _firebaseAvailable = false;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  Future<void> _registerDevice(String token) async {
    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/users/me/devices');
      final headers = {
        'Content-Type': 'application/json',
        ...ApiClient.instance.authHeaders(),
      };
      final body = jsonEncode({
        'token': token,
        'platform': _platformLabel(),
        'deviceName': await _deviceLabel(),
        if (_userId != null) 'userId': _userId,
      });
      final resp = await http
          .post(uri, headers: headers, body: body)
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 404) {
        debugPrint('[PushService] /users/me/devices not implemented yet (404).');
        return;
      }
      if (resp.statusCode >= 400) {
        debugPrint('[PushService] device register HTTP ${resp.statusCode}: ${resp.body}');
      } else if (kDebugMode) {
        debugPrint('[PushService] device registered (${resp.statusCode})');
      }
    } catch (e) {
      // Never crash — registration is best-effort.
      debugPrint('[PushService] device register failed: $e');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    if (kDebugMode) {
      debugPrint('[PushService.fg] ${message.messageId} data=${message.data}');
    }
    final ctx = pushNavigatorKey.currentState?.overlay?.context;
    if (ctx == null) return;
    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString() ?? 'Notification';
    final body = notification?.body ?? message.data['body']?.toString() ?? '';

    final messenger = ScaffoldMessenger.maybeOf(ctx);
    messenger?.showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 6),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            if (body.isNotEmpty) Text(body),
          ],
        ),
        action: SnackBarAction(
          label: 'Open',
          onPressed: () => _openNotification(message),
        ),
      ),
    );
  }

  void _onOpenedApp(RemoteMessage message) {
    if (kDebugMode) {
      debugPrint('[PushService.tap] ${message.messageId} data=${message.data}');
    }
    _openNotification(message);
  }

  void _openNotification(RemoteMessage message) {
    final navigator = pushNavigatorKey.currentState;
    if (navigator == null) return;
    final notificationId = message.data['notificationId']?.toString();
    if (notificationId != null && notificationId.isNotEmpty) {
      navigator.pushNamed('/notifications/$notificationId');
    } else {
      navigator.pushNamed('/notifications');
    }
  }

  String _platformLabel() {
    if (kIsWeb) return 'web';
    try {
      if (Platform.isIOS) return 'ios';
      if (Platform.isAndroid) return 'android';
      if (Platform.isMacOS) return 'macos';
    } catch (_) {
      // Platform may not be available on web isolate.
    }
    return 'unknown';
  }

  Future<String> _deviceLabel() async {
    if (kIsWeb) return 'web-browser';
    try {
      if (Platform.isIOS) return 'iOS device';
      if (Platform.isAndroid) return 'Android device';
    } catch (_) {}
    return 'device';
  }
}

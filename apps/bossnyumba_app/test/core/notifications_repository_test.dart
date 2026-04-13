import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bossnyumba_app/core/api_client.dart';
import 'package:bossnyumba_app/core/notifications/notifications_repository.dart';
import 'package:bossnyumba_app/core/notifications/push_service.dart';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

class _Scripted {
  final Object? data;
  final String? error;
  final int? statusCode;
  _Scripted.ok(this.data, {this.statusCode = 200}) : error = null;
  _Scripted.err(this.error, {this.statusCode}) : data = null;
}

ApiResponse<T> _materialize<T>(_Scripted s) {
  if (s.error == null) {
    return ApiResponse.ok(s.data as T);
  }
  return ApiResponse.error(s.error!, statusCode: s.statusCode);
}

class _FakeApiClient extends ApiClient {
  final Map<String, _Scripted> getResponses = {};
  final Map<String, _Scripted> postResponses = {};
  final Map<String, _Scripted> patchResponses = {};

  final List<String> getCalls = [];
  final List<({String path, Object? body})> postCalls = [];
  final List<({String path, Object? body})> patchCalls = [];

  @override
  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    getCalls.add(path);
    final r = getResponses[path];
    if (r == null) {
      return ApiResponse.error('no fake for GET $path', statusCode: 404);
    }
    return _materialize<T>(r);
  }

  @override
  Future<ApiResponse<T>> post<T>(String path, {Object? body}) async {
    postCalls.add((path: path, body: body));
    final r = postResponses[path];
    if (r == null) {
      return ApiResponse.error('no fake for POST $path', statusCode: 404);
    }
    return _materialize<T>(r);
  }

  @override
  Future<ApiResponse<T>> patch<T>(String path, {Object? body}) async {
    patchCalls.add((path: path, body: body));
    final r = patchResponses[path];
    if (r == null) {
      return ApiResponse.error('no fake for PATCH $path', statusCode: 404);
    }
    return _materialize<T>(r);
  }
}

Map<String, dynamic> _fakeNotificationJson({
  required String id,
  String title = 'Hello',
  String body = 'World',
  String type = 'invoice',
  String severity = 'info',
  bool read = false,
  String? deepLink,
  Map<String, dynamic>? data,
}) {
  return {
    'id': id,
    'title': title,
    'body': body,
    'type': type,
    'severity': severity,
    'read': read,
    'createdAt': DateTime.now().toUtc().toIso8601String(),
    if (deepLink != null) 'deepLink': deepLink,
    if (data != null) 'data': data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Shared_preferences uses a method channel — stub it out so the repo's
  // cache calls don't explode in unit tests.
  setUp(() {
    const channel = MethodChannel('plugins.flutter.io/shared_preferences');
    final store = <String, Object>{};
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'getAll':
          return store;
        case 'setString':
        case 'setInt':
        case 'setBool':
        case 'setDouble':
        case 'setStringList':
          final args = call.arguments as Map;
          store[args['key'] as String] = args['value'] as Object;
          return true;
        case 'remove':
          final args = call.arguments as Map;
          store.remove(args['key'] as String);
          return true;
        case 'clear':
          store.clear();
          return true;
        default:
          return null;
      }
    });
  });

  group('NotificationsRepository.refresh (list)', () {
    test('parses a top-level list response', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok([
        _fakeNotificationJson(id: 'n1'),
        _fakeNotificationJson(id: 'n2', read: true),
      ]);
      final repo = NotificationsRepository(api: api);

      await repo.refresh();

      expect(repo.items.length, 2);
      expect(repo.items.first.id, 'n1');
      expect(repo.items.first.read, isFalse);
      expect(repo.items[1].read, isTrue);
      expect(repo.unreadCount, 1);
      expect(repo.error, isNull);
    });

    test('parses a wrapped {items: [...]} response', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok({
        'items': [
          _fakeNotificationJson(id: 'n1', severity: 'critical'),
          _fakeNotificationJson(id: 'n2'),
          _fakeNotificationJson(id: 'n3', severity: 'critical'),
        ],
      });
      final repo = NotificationsRepository(api: api);

      await repo.refresh();

      expect(repo.items.length, 3);
      expect(repo.criticalCount, 2);
    });

    test('filter(critical) only returns critical items', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok([
        _fakeNotificationJson(id: 'a', severity: 'info'),
        _fakeNotificationJson(id: 'b', severity: 'critical'),
        _fakeNotificationJson(id: 'c', severity: 'warning'),
        _fakeNotificationJson(id: 'd', severity: 'critical', read: true),
      ]);
      final repo = NotificationsRepository(api: api);
      await repo.refresh();

      final critical = repo.filter(NotificationsFilter.critical);
      expect(critical.length, 2);
      expect(critical.every((n) => n.severity == NotificationSeverity.critical),
          isTrue);

      final unread = repo.filter(NotificationsFilter.unread);
      expect(unread.length, 3);
    });

    test('refresh failure surfaces error and does not wipe memory', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] =
          _Scripted.ok([_fakeNotificationJson(id: 'a')]);
      final repo = NotificationsRepository(api: api);
      await repo.refresh();
      expect(repo.items.length, 1);

      // Now swap to an error response and refresh again.
      api.getResponses['/api/v1/notifications'] =
          _Scripted.err('boom', statusCode: 500);
      await repo.refresh();

      expect(repo.error, 'boom');
      // Existing items retained.
      expect(repo.items.length, 1);
    });
  });

  group('markRead', () {
    test('marks a single notification read and calls PATCH', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok([
        _fakeNotificationJson(id: 'x1'),
        _fakeNotificationJson(id: 'x2'),
      ]);
      api.patchResponses['/api/v1/notifications/x1/read'] =
          _Scripted.ok({'ok': true});

      final repo = NotificationsRepository(api: api);
      await repo.refresh();
      expect(repo.unreadCount, 2);

      final ok = await repo.markRead('x1');

      expect(ok, isTrue);
      expect(api.patchCalls.any((c) => c.path == '/api/v1/notifications/x1/read'),
          isTrue);
      expect(repo.items.firstWhere((n) => n.id == 'x1').read, isTrue);
      expect(repo.items.firstWhere((n) => n.id == 'x2').read, isFalse);
      expect(repo.unreadCount, 1);
    });

    test('markRead returns false on API failure and keeps unread state',
        () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] =
          _Scripted.ok([_fakeNotificationJson(id: 'x1')]);
      api.patchResponses['/api/v1/notifications/x1/read'] =
          _Scripted.err('nope', statusCode: 500);

      final repo = NotificationsRepository(api: api);
      await repo.refresh();
      final ok = await repo.markRead('x1');

      expect(ok, isFalse);
      expect(repo.items.first.read, isFalse);
    });
  });

  group('markAllRead', () {
    test('flips every item to read and calls /read-all', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok([
        _fakeNotificationJson(id: 'a'),
        _fakeNotificationJson(id: 'b'),
        _fakeNotificationJson(id: 'c', read: true),
      ]);
      api.postResponses['/api/v1/notifications/read-all'] =
          _Scripted.ok({'updated': 2});

      final repo = NotificationsRepository(api: api);
      await repo.refresh();
      expect(repo.unreadCount, 2);

      final ok = await repo.markAllRead();

      expect(ok, isTrue);
      expect(
          api.postCalls
              .any((c) => c.path == '/api/v1/notifications/read-all'),
          isTrue);
      expect(repo.unreadCount, 0);
      expect(repo.items.every((n) => n.read), isTrue);
    });

    test('markAllRead returns false on failure and leaves state untouched',
        () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok([
        _fakeNotificationJson(id: 'a'),
      ]);
      api.postResponses['/api/v1/notifications/read-all'] =
          _Scripted.err('boom', statusCode: 500);

      final repo = NotificationsRepository(api: api);
      await repo.refresh();
      final ok = await repo.markAllRead();

      expect(ok, isFalse);
      expect(repo.unreadCount, 1);
    });
  });

  group('getById', () {
    test('returns from memory without hitting the API', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications'] = _Scripted.ok([
        _fakeNotificationJson(id: 'cached-1', title: 'from list'),
      ]);
      final repo = NotificationsRepository(api: api);
      await repo.refresh();

      final n = await repo.getById('cached-1');
      expect(n, isNotNull);
      expect(n!.title, 'from list');
      expect(api.getCalls.where((c) => c.contains('cached-1')), isEmpty);
    });

    test('falls back to network fetch when not in memory', () async {
      final api = _FakeApiClient();
      api.getResponses['/api/v1/notifications/remote-1'] = _Scripted.ok(
        _fakeNotificationJson(id: 'remote-1', title: 'from server'),
      );
      final repo = NotificationsRepository(api: api);

      final n = await repo.getById('remote-1');
      expect(n, isNotNull);
      expect(n!.title, 'from server');
      expect(repo.items.any((i) => i.id == 'remote-1'), isTrue);
    });
  });

  group('PushService.deepLinkFor', () {
    test('approval type routes to /owner/approvals/{id}', () {
      final msg = RemoteMessage(data: {
        'type': 'approval',
        'id': 'apr-1',
        'notificationId': 'n-1',
      });
      expect(PushService.deepLinkFor(msg), '/owner/approvals/apr-1');
    });

    test('invoice_overdue type routes to /owner/invoices/{id}', () {
      final msg = RemoteMessage(data: {
        'type': 'invoice_overdue',
        'id': 'inv-42',
      });
      expect(PushService.deepLinkFor(msg), '/owner/invoices/inv-42');
    });

    test('work_order_urgent routes to /owner/work-orders/{id}', () {
      final msg = RemoteMessage(data: {
        'type': 'work_order_urgent',
        'resourceId': 'wo-9',
      });
      expect(PushService.deepLinkFor(msg), '/owner/work-orders/wo-9');
    });

    test('tenant_alert routes to /owner/tenants/{id}', () {
      final msg = RemoteMessage(data: {
        'type': 'tenant_alert',
        'id': 'tenant-5',
      });
      expect(PushService.deepLinkFor(msg), '/owner/tenants/tenant-5');
    });

    test('unknown type with id falls back to /owner/notifications/{id}', () {
      final msg = RemoteMessage(data: {
        'id': 'generic-1',
      });
      expect(PushService.deepLinkFor(msg), '/owner/notifications/generic-1');
    });

    test('missing id falls back to inbox root', () {
      final msg = RemoteMessage(data: {'type': 'approval'});
      expect(PushService.deepLinkFor(msg), '/owner/notifications');
    });

    test('payload with only notificationId still resolves', () {
      final msg = RemoteMessage(data: {
        'type': 'notification',
        'notificationId': 'only-nid',
      });
      expect(PushService.deepLinkFor(msg), '/owner/notifications/only-nid');
    });
  });
}

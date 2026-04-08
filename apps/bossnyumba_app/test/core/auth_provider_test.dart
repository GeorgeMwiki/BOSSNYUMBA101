import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:bossnyumba_app/core/api_client.dart';
import 'package:bossnyumba_app/core/auth_provider.dart';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

/// A scripted response in untyped form — the fake client boxes it back into
/// a concrete `ApiResponse<T>` at the call site so the generic type lines up
/// with whatever the production code asks for.
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

/// An in-memory fake [ApiClient] that lets tests script responses per path
/// and per method without touching the network.
class _FakeApiClient extends ApiClient {
  final Map<String, _Scripted> getResponses = {};
  final Map<String, _Scripted> postResponses = {};

  final List<String> getCalls = [];
  final List<({String path, Object? body})> postCalls = [];

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
}

/// In-memory secure storage backed by a method-channel mock. The plugin
/// routes all reads/writes through `plugins.it_nomads.com/flutter_secure_storage`
/// so intercepting that channel gives us a clean fake.
class _FakeSecureStorage {
  final Map<String, String> _store = {};

  void install() {
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      switch (call.method) {
        case 'read':
          final key = (call.arguments as Map)['key'] as String;
          return _store[key];
        case 'readAll':
          return Map<String, String>.from(_store);
        case 'write':
          final args = call.arguments as Map;
          _store[args['key'] as String] = args['value'] as String;
          return null;
        case 'delete':
          _store.remove((call.arguments as Map)['key'] as String);
          return null;
        case 'deleteAll':
          _store.clear();
          return null;
        case 'containsKey':
          return _store.containsKey((call.arguments as Map)['key'] as String);
        default:
          return null;
      }
    });
  }

  void uninstall() {
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  }

  Map<String, String> get snapshot => Map.unmodifiable(_store);
  void seed(String key, String value) => _store[key] = value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Builds a fake JWT with the given claims. Signature is not verified by the
/// provider so we can use an arbitrary "sig" segment.
String _makeJwt(Map<String, dynamic> claims) {
  String b64(Map<String, dynamic> m) {
    return base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  }

  final header = b64({'alg': 'HS256', 'typ': 'JWT'});
  final payload = b64(claims);
  return '$header.$payload.fakesig';
}

int _futureEpoch({Duration offset = const Duration(hours: 1)}) =>
    (DateTime.now().toUtc().add(offset).millisecondsSinceEpoch ~/ 1000);

int _pastEpoch({Duration offset = const Duration(hours: 1)}) =>
    (DateTime.now().toUtc().subtract(offset).millisecondsSinceEpoch ~/ 1000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeSecureStorage fakeStorage;
  late _FakeApiClient api;

  setUp(() {
    fakeStorage = _FakeSecureStorage()..install();
    api = _FakeApiClient();
  });

  tearDown(() {
    fakeStorage.uninstall();
  });

  AuthProvider newProvider({bool autoRestore = false}) {
    return AuthProvider(
      api: api,
      storage: const FlutterSecureStorage(),
      autoRestore: autoRestore,
    );
  }

  group('decodeJwt / isJwtExpired', () {
    test('decodes a valid JWT payload', () {
      final token = _makeJwt({'sub': 'u1', 'exp': _futureEpoch()});
      final claims = decodeJwt(token);
      expect(claims, isNotNull);
      expect(claims!['sub'], 'u1');
    });

    test('returns null for a malformed token', () {
      expect(decodeJwt('not-a-jwt'), isNull);
    });

    test('marks an expired token as expired', () {
      final token = _makeJwt({'sub': 'u1', 'exp': _pastEpoch()});
      expect(isJwtExpired(token), isTrue);
    });

    test('treats a fresh token as not expired', () {
      final token = _makeJwt({'sub': 'u1', 'exp': _futureEpoch()});
      expect(isJwtExpired(token), isFalse);
    });
  });

  group('login', () {
    test('success stores token and hydrates session from JWT claims', () async {
      final token = _makeJwt({
        'sub': 'user-123',
        'email': 'alice@example.com',
        'role': 'RESIDENT',
        'tenantId': 'tenant-abc',
        'exp': _futureEpoch(),
      });

      api.postResponses['/auth/login'] = _Scripted.ok({
        'accessToken': token,
        'refreshToken': 'refresh-xyz',
      });
      api.getResponses['/auth/me'] = _Scripted.ok({
        'user': {
          'id': 'user-123',
          'email': 'alice@example.com',
          'firstName': 'Alice',
          'lastName': 'A',
          'role': 'RESIDENT',
          'tenantId': 'tenant-abc',
        }
      });

      final auth = newProvider();
      await auth.login('alice@example.com', 'pw');

      expect(auth.isAuthenticated, isTrue);
      expect(auth.token, token);
      expect(auth.userId, 'user-123');
      expect(auth.tenantId, 'tenant-abc');
      expect(auth.role, UserRole.resident);
      expect(auth.isLoading, isFalse);
      expect(fakeStorage.snapshot['access_token'], token);
      expect(fakeStorage.snapshot['refresh_token'], 'refresh-xyz');
    });

    test('failure does not store a token and throws AuthException', () async {
      api.postResponses['/auth/login'] =
          _Scripted.err('Invalid credentials', statusCode: 401);

      final auth = newProvider();
      await expectLater(
        () => auth.login('bad@example.com', 'nope'),
        throwsA(isA<AuthException>()),
      );
      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.session, isNull);
      expect(fakeStorage.snapshot, isEmpty);
    });

    test('response without a token throws AuthException', () async {
      api.postResponses['/auth/login'] = _Scripted.ok({'ok': true});

      final auth = newProvider();
      await expectLater(
        () => auth.login('a@b.com', 'pw'),
        throwsA(isA<AuthException>()),
      );
      expect(auth.isAuthenticated, isFalse);
      expect(fakeStorage.snapshot, isEmpty);
    });
  });

  group('logout', () {
    test('clears local state and secure storage', () async {
      fakeStorage.seed('access_token', _makeJwt({'sub': 'u1', 'exp': _futureEpoch()}));
      fakeStorage.seed('refresh_token', 'r1');
      api.postResponses['/auth/logout'] = _Scripted.ok({});
      api.getResponses['/auth/me'] = _Scripted.ok({
        'user': {
          'id': 'u1',
          'email': 'u1@example.com',
          'firstName': 'U',
          'lastName': '1',
          'role': 'RESIDENT',
        }
      });

      final auth = newProvider();
      await auth.restoreSession();
      expect(auth.isAuthenticated, isTrue);

      await auth.logout();

      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.session, isNull);
      expect(fakeStorage.snapshot, isEmpty);
      expect(api.postCalls.any((c) => c.path == '/auth/logout'), isTrue);
    });

    test('still clears state when server logout fails', () async {
      fakeStorage.seed('access_token', _makeJwt({'sub': 'u1', 'exp': _futureEpoch()}));
      api.postResponses['/auth/logout'] =
          _Scripted.err('boom', statusCode: 500);
      api.getResponses['/auth/me'] = _Scripted.ok({
        'user': {
          'id': 'u1',
          'email': 'u1@example.com',
          'firstName': 'U',
          'lastName': '1',
          'role': 'RESIDENT',
        }
      });

      final auth = newProvider();
      await auth.restoreSession();
      await auth.logout();
      expect(auth.isAuthenticated, isFalse);
      expect(fakeStorage.snapshot, isEmpty);
    });
  });

  group('restoreSession', () {
    test('valid token restores session via /auth/me', () async {
      final token = _makeJwt({
        'sub': 'user-9',
        'email': 'bob@example.com',
        'role': 'PROPERTY_MANAGER',
        'tenantId': 't-9',
        'exp': _futureEpoch(),
      });
      fakeStorage.seed('access_token', token);
      api.getResponses['/auth/me'] = _Scripted.ok({
        'user': {
          'id': 'user-9',
          'email': 'bob@example.com',
          'firstName': 'Bob',
          'lastName': 'B',
          'role': 'PROPERTY_MANAGER',
          'tenantId': 't-9',
        }
      });

      final auth = newProvider();
      await auth.restoreSession();

      expect(auth.isAuthenticated, isTrue);
      expect(auth.userId, 'user-9');
      expect(auth.tenantId, 't-9');
      expect(auth.role, UserRole.propertyManager);
      expect(auth.isLoading, isFalse);
      expect(fakeStorage.snapshot['access_token'], token);
    });

    test('expired token with no refresh token clears state', () async {
      final expired = _makeJwt({'sub': 'u', 'exp': _pastEpoch()});
      fakeStorage.seed('access_token', expired);

      final auth = newProvider();
      await auth.restoreSession();

      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.session, isNull);
      expect(fakeStorage.snapshot, isEmpty);
    });

    test('missing token leaves provider unauthenticated', () async {
      final auth = newProvider();
      await auth.restoreSession();
      expect(auth.isAuthenticated, isFalse);
      expect(auth.isLoading, isFalse);
    });

    test('expired access token with refresh token rotates to a new token',
        () async {
      final expired = _makeJwt({'sub': 'u', 'exp': _pastEpoch()});
      final fresh = _makeJwt({
        'sub': 'u',
        'email': 'u@example.com',
        'role': 'RESIDENT',
        'tenantId': 't',
        'exp': _futureEpoch(),
      });
      fakeStorage.seed('access_token', expired);
      fakeStorage.seed('refresh_token', 'r-1');

      api.postResponses['/auth/refresh'] = _Scripted.ok({
        'accessToken': fresh,
        'refreshToken': 'r-2',
      });
      api.getResponses['/auth/me'] = _Scripted.ok({
        'user': {
          'id': 'u',
          'email': 'u@example.com',
          'firstName': 'U',
          'lastName': 'X',
          'role': 'RESIDENT',
          'tenantId': 't',
        }
      });

      final auth = newProvider();
      await auth.restoreSession();

      expect(auth.isAuthenticated, isTrue);
      expect(auth.token, fresh);
      expect(fakeStorage.snapshot['access_token'], fresh);
      expect(fakeStorage.snapshot['refresh_token'], 'r-2');
    });
  });

  group('ApiClient integration', () {
    test('tokenProvider is wired so requests see the live access token',
        () async {
      final token = _makeJwt({
        'sub': 'u',
        'email': 'u@example.com',
        'role': 'RESIDENT',
        'exp': _futureEpoch(),
      });
      api.postResponses['/auth/login'] = _Scripted.ok({'accessToken': token});
      api.postResponses['/auth/logout'] = _Scripted.ok({});
      api.getResponses['/auth/me'] = _Scripted.ok({
        'user': {
          'id': 'u',
          'email': 'u@example.com',
          'firstName': 'U',
          'lastName': 'X',
          'role': 'RESIDENT',
        }
      });

      final auth = newProvider();
      expect(api.tokenProvider, isNotNull);
      expect(api.tokenProvider!.call(), isNull);

      await auth.login('u@example.com', 'pw');
      expect(api.tokenProvider!.call(), token);

      await auth.logout();
      expect(api.tokenProvider!.call(), isNull);
    });
  });
}

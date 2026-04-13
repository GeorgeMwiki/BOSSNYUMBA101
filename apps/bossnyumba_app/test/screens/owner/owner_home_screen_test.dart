import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:bossnyumba_app/core/api_client.dart';
import 'package:bossnyumba_app/core/auth_provider.dart';
import 'package:bossnyumba_app/screens/owner/owner_home_screen.dart';

/// Fake ApiClient that returns canned responses keyed by path.
///
/// We rely on the fact that `ApiClient()`'s constructor uses
/// `_instance ??= this`, so the first instance constructed in a test isolate
/// wins. We construct ONE fake at the top of this file and mutate its
/// `responses` map between tests.
class _FakeApiClient extends ApiClient {
  final Map<String, ApiResponse<Map<String, dynamic>>> responses = {};
  final List<String> calls = [];

  @override
  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    calls.add(path);
    final r = responses[path];
    if (r == null) {
      return ApiResponse<T>.ok(<String, dynamic>{} as T);
    }
    if (!r.isOk) {
      return ApiResponse<T>.error(r.error ?? 'error',
          statusCode: r.statusCode);
    }
    return ApiResponse<T>.ok((r.data ?? const <String, dynamic>{}) as T);
  }
}

/// The single fake used across all tests in this file. Must be constructed
/// BEFORE anything reads `ApiClient.instance`, otherwise the real client
/// gets cached and we can't displace it.
final _fake = _FakeApiClient();

class _FakeAuthProvider extends ChangeNotifier implements AuthProvider {
  UserSession? _session;
  _FakeAuthProvider(this._session);

  void setSession(UserSession? s) {
    _session = s;
    notifyListeners();
  }

  @override
  UserSession? get session => _session;
  @override
  bool get isAuthenticated => _session != null;
  @override
  bool get loading => false;
  @override
  UserRole get role => _session?.role ?? UserRole.unknown;
  @override
  bool get isCustomer => role.isCustomer;
  @override
  bool get isEstateManager => role.isEstateManager;
  @override
  bool get isOwner => role.isOwner;
  @override
  bool get isAdmin => role.isAdmin;
  @override
  bool get isAccountant => role.isAccountant;
  @override
  Future<bool> login(String email, String password) async => false;
  @override
  Future<bool> register(
    String email,
    String password,
    String firstName,
    String lastName, {
    String? phone,
  }) async =>
      false;
  @override
  Future<void> logout() async {}

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

UserSession _buildSession({String tenantId = 't1'}) => UserSession(
      id: 'u1',
      email: 'owner@example.com',
      firstName: 'Ada',
      lastName: 'Kamau',
      tenantId: tenantId,
      tenantName: 'Kamau Holdings',
      role: UserRole.owner,
    );

Widget _wrap({
  required _FakeAuthProvider auth,
  required Widget child,
}) {
  return ChangeNotifierProvider<AuthProvider>.value(
    value: auth,
    child: MaterialApp(home: child),
  );
}

void _seedOk() {
  _fake.responses
    ..clear()
    ..['/analytics/summary'] = ApiResponse.ok({
      'collectionRate': 94,
      'collectionRateDelta': 3.2,
      'occupancyRate': 88,
      'occupancyRateDelta': -1.5,
      'arrearsTotal': 145000,
      'openTickets': 7,
      'criticalTickets': 2,
    })
    ..['/owner/agenda'] = ApiResponse.ok({'items': []})
    ..['/notifications'] = ApiResponse.ok({'items': []})
    ..['/approvals'] = ApiResponse.ok({'total': 0, 'items': []});
  _fake.calls.clear();
}

void _seedError() {
  _fake.responses
    ..clear()
    ..['/analytics/summary'] =
        ApiResponse<Map<String, dynamic>>.error('nope', statusCode: 500)
    ..['/owner/agenda'] =
        ApiResponse<Map<String, dynamic>>.error('nope', statusCode: 500)
    ..['/notifications'] =
        ApiResponse<Map<String, dynamic>>.error('nope', statusCode: 500)
    ..['/approvals'] =
        ApiResponse<Map<String, dynamic>>.error('nope', statusCode: 500);
  _fake.calls.clear();
}

void main() {
  // Sanity check: the ApiClient singleton should be our fake. If this fails,
  // something in the import chain touched `ApiClient.instance` before our
  // top-level `_fake` initialiser ran. The test file is structured so that
  // `_fake` is the first reference to ApiClient, making its super-ctor the
  // first to execute and cache _instance.
  setUpAll(() {
    // Force lazy init of `_fake` FIRST. Its super-ctor writes
    // `ApiClient._instance ??= this`, making it the singleton — provided
    // nothing read `ApiClient.instance` before this point.
    final installed = _fake;
    expect(identical(ApiClient.instance, installed), isTrue,
        reason:
            'Test fake was not installed as the ApiClient singleton; ensure nothing touches ApiClient.instance before _fake is constructed.');
  });

  group('OwnerHomeScreen', () {
    testWidgets('renders KPIs from mocked API response', (tester) async {
      _seedOk();

      final auth = _FakeAuthProvider(_buildSession());
      await tester
          .pumpWidget(_wrap(auth: auth, child: const OwnerHomeScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Boss Dashboard'), findsOneWidget);
      expect(find.textContaining('Ada'), findsOneWidget);
      // KPI values rendered.
      expect(find.text('94%'), findsOneWidget);
      expect(find.text('88%'), findsOneWidget);
      expect(find.text('KES 145,000'), findsOneWidget);
      expect(find.text('7'), findsOneWidget);
      // Critical ticket badge.
      expect(find.text('2'), findsOneWidget);
      // Empty agenda state.
      expect(find.byKey(const Key('agenda-empty')), findsOneWidget);
    });

    testWidgets('loading skeletons appear initially', (tester) async {
      _seedOk();

      final auth = _FakeAuthProvider(_buildSession());
      await tester
          .pumpWidget(_wrap(auth: auth, child: const OwnerHomeScreen()));
      // One pump triggers the postFrameCallback that kicks off loads but
      // does NOT resolve the FutureBuilders — so skeletons should still
      // be visible.
      await tester.pump();
      expect(find.byKey(const Key('kpi-skeleton')), findsWidgets);
      // Let futures resolve to avoid pending timers at teardown.
      await tester.pumpAndSettle();
    });

    testWidgets('error state has a retry button', (tester) async {
      _seedError();

      final auth = _FakeAuthProvider(_buildSession());
      await tester
          .pumpWidget(_wrap(auth: auth, child: const OwnerHomeScreen()));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('error-card')), findsWidgets);
      expect(find.widgetWithText(TextButton, 'Retry'), findsWidgets);

      // Tap retry — should re-issue the summary call.
      final before =
          _fake.calls.where((c) => c == '/analytics/summary').length;
      await tester.tap(find.widgetWithText(TextButton, 'Retry').first);
      await tester.pumpAndSettle();
      final after =
          _fake.calls.where((c) => c == '/analytics/summary').length;
      expect(after, greaterThan(before));
    });

    testWidgets('refetches when active org (tenantId) changes',
        (tester) async {
      _seedOk();

      final auth = _FakeAuthProvider(_buildSession(tenantId: 't1'));
      await tester
          .pumpWidget(_wrap(auth: auth, child: const OwnerHomeScreen()));
      await tester.pumpAndSettle();

      final callsBefore =
          _fake.calls.where((c) => c == '/analytics/summary').length;
      expect(callsBefore, greaterThanOrEqualTo(1));

      // Flip the active org — should trigger a refetch via didChangeDependencies.
      auth.setSession(_buildSession(tenantId: 't2'));
      await tester.pumpAndSettle();

      final callsAfter =
          _fake.calls.where((c) => c == '/analytics/summary').length;
      expect(callsAfter, greaterThan(callsBefore));
    });
  });
}

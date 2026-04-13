// Widget tests for [OwnerApprovalsScreen].
//
// Uses a [_FakeApprovalsRepository] so no HTTP or provider wiring is
// needed, and the heavyweight [ApiClient] is never instantiated. The
// screen accepts an optional `repository` for exactly this reason.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:bossnyumba_app/core/approvals/approval.dart';
import 'package:bossnyumba_app/core/approvals/approvals_repository.dart';
import 'package:bossnyumba_app/core/approvals/org_scope.dart';
import 'package:bossnyumba_app/screens/owner/approval_detail_screen.dart';
import 'package:bossnyumba_app/screens/owner/owner_approvals_screen.dart';

void main() {
  setUp(() {
    // Replace biometric gate so modal confirms don't block tests.
    BiometricGate.override = (ctx, reason) async => true;
  });

  tearDown(() {
    BiometricGate.override = null;
  });

  Approval vendorInvoice({
    String id = 'v1',
    String title = 'Plumbing repair invoice',
    String vendor = 'Mombasa Plumbing',
    double amount = 45000,
  }) {
    return VendorInvoiceApproval(
      id: id,
      title: title,
      subtitle: '$vendor · KES ${amount.toInt()}',
      amount: amount,
      currency: 'KES',
      requestedAt: DateTime.now().subtract(const Duration(hours: 2)),
      requestedBy: 'Manager Joy',
      vendorName: vendor,
      lineItems: const [],
      subtotal: amount,
      tax: 0,
    );
  }

  Approval workOrder({
    String id = 'w1',
    String title = 'Roof quote',
    double amount = 180000,
  }) {
    return WorkOrderApproval(
      id: id,
      title: title,
      subtitle: 'Unit A3 · KES ${amount.toInt()}',
      amount: amount,
      currency: 'KES',
      requestedAt: DateTime.now().subtract(const Duration(days: 1)),
      requestedBy: 'Manager Joy',
      unit: 'A3',
    );
  }

  Future<void> pumpScreen(
    WidgetTester tester, {
    required _FakeApprovalsRepository repo,
    OrgProvider? org,
  }) async {
    final orgProvider = org ?? OrgProvider(initialOrgId: 'org_1');
    await tester.pumpWidget(
      ChangeNotifierProvider<OrgProvider>.value(
        value: orgProvider,
        child: MaterialApp(
          home: OwnerApprovalsScreen(repository: repo),
        ),
      ),
    );
    // Resolve the initial async fetch.
    await tester.pumpAndSettle();
  }

  testWidgets('renders a card per approval with amount', (tester) async {
    final repo = _FakeApprovalsRepository(items: [
      vendorInvoice(title: 'Plumbing invoice', amount: 45000),
      workOrder(title: 'Roof quote', amount: 180000),
    ]);

    await pumpScreen(tester, repo: repo);

    expect(find.text('Plumbing invoice'), findsOneWidget);
    expect(find.text('Roof quote'), findsOneWidget);
    // Amount badges use intl currency — look for the numeric portion.
    expect(find.textContaining('45,000'), findsOneWidget);
    expect(find.textContaining('180,000'), findsOneWidget);
  });

  testWidgets('loading state shows skeletons before data arrives',
      (tester) async {
    final repo = _FakeApprovalsRepository(
      items: [vendorInvoice()],
      delay: const Duration(milliseconds: 200),
    );
    await tester.pumpWidget(
      ChangeNotifierProvider<OrgProvider>.value(
        value: OrgProvider(initialOrgId: 'org_1'),
        child: MaterialApp(home: OwnerApprovalsScreen(repository: repo)),
      ),
    );
    // First frame: loading.
    await tester.pump();
    // Skeleton cards have no real title text yet.
    expect(find.text('Plumbing repair invoice'), findsNothing);
    // ChoiceChips from the filter bar should already be present.
    expect(find.text('All'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Plumbing repair invoice'), findsOneWidget);
  });

  testWidgets('empty state shows the reassuring message', (tester) async {
    final repo = _FakeApprovalsRepository(items: const []);
    await pumpScreen(tester, repo: repo);
    expect(find.text('Nothing to approve right now'), findsOneWidget);
  });

  testWidgets('error state renders a retry button', (tester) async {
    final repo = _FakeApprovalsRepository(failNext: 'boom');
    await pumpScreen(tester, repo: repo);
    expect(find.textContaining('boom'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);

    // Retry succeeds with the seeded item.
    repo.failNext = null;
    repo.items = [vendorInvoice(title: 'Recovered')];
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Recovered'), findsOneWidget);
  });

  testWidgets('swipe-right approve calls repository after snackbar expires',
      (tester) async {
    final repo = _FakeApprovalsRepository(items: [
      vendorInvoice(id: 'v1', title: 'Plumbing invoice'),
    ]);
    await pumpScreen(tester, repo: repo);

    await tester.drag(
      find.text('Plumbing invoice'),
      const Offset(600, 0),
    );
    await tester.pumpAndSettle();

    // Card is gone from the list; snackbar is up.
    expect(find.text('Plumbing invoice'), findsNothing);
    expect(find.textContaining('Approving'), findsOneWidget);

    // Let the 4-second snackbar auto-dismiss, then give the repo future
    // a chance to resolve.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(repo.approvedIds, contains('v1'));
    expect(repo.rejectedIds, isEmpty);
  });

  testWidgets('swipe-right then Undo cancels the approve call',
      (tester) async {
    final repo = _FakeApprovalsRepository(items: [
      vendorInvoice(id: 'v1', title: 'Plumbing invoice'),
    ]);
    await pumpScreen(tester, repo: repo);

    await tester.drag(find.text('Plumbing invoice'), const Offset(600, 0));
    await tester.pumpAndSettle();
    expect(find.text('Undo'), findsOneWidget);

    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();

    // Card restored, no API call fired.
    expect(find.text('Plumbing invoice'), findsOneWidget);
    expect(repo.approvedIds, isEmpty);
  });

  testWidgets('swipe-left reject removes the card and queues rejection',
      (tester) async {
    final repo = _FakeApprovalsRepository(items: [
      vendorInvoice(id: 'v1', title: 'Plumbing invoice'),
    ]);
    await pumpScreen(tester, repo: repo);

    await tester.drag(find.text('Plumbing invoice'), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(find.text('Plumbing invoice'), findsNothing);
    expect(find.textContaining('Rejecting'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(repo.rejectedIds, contains('v1'));
  });

  testWidgets('filter chip narrows the list', (tester) async {
    final repo = _FakeApprovalsRepository(items: [
      vendorInvoice(id: 'v1', title: 'Plumbing invoice'),
      workOrder(id: 'w1', title: 'Roof quote'),
    ]);
    await pumpScreen(tester, repo: repo);

    // Both visible under "All".
    expect(find.text('Plumbing invoice'), findsOneWidget);
    expect(find.text('Roof quote'), findsOneWidget);

    // Configure the fake to filter server-side by type.
    repo.filteredItems = {
      'work_order': [workOrder(id: 'w1', title: 'Roof quote')],
    };

    await tester.tap(find.text('Work orders'));
    await tester.pumpAndSettle();

    expect(find.text('Plumbing invoice'), findsNothing);
    expect(find.text('Roof quote'), findsOneWidget);
    expect(repo.lastType, 'work_order');
  });

  testWidgets('activeOrgId change triggers refetch', (tester) async {
    final repo = _FakeApprovalsRepository(items: [
      vendorInvoice(id: 'v1', title: 'From org 1'),
    ]);
    final org = OrgProvider(initialOrgId: 'org_1');
    await pumpScreen(tester, repo: repo, org: org);
    expect(find.text('From org 1'), findsOneWidget);
    expect(repo.listCalls, 1);

    repo.items = [vendorInvoice(id: 'v2', title: 'From org 2')];
    org.setActiveOrgId('org_2');
    await tester.pumpAndSettle();

    expect(find.text('From org 2'), findsOneWidget);
    expect(find.text('From org 1'), findsNothing);
    expect(repo.listCalls, greaterThanOrEqualTo(2));
    expect(repo.lastOrgId, 'org_2');
  });
}

// ---------------------------------------------------------------------------
// Fake repository
// ---------------------------------------------------------------------------

class _FakeApprovalsRepository implements ApprovalsRepository {
  List<Approval> items;
  Map<String, List<Approval>> filteredItems;
  String? failNext;
  Duration? delay;

  int listCalls = 0;
  String? lastOrgId;
  String? lastType;
  final List<String> approvedIds = [];
  final List<String> rejectedIds = [];

  _FakeApprovalsRepository({
    this.items = const [],
    this.filteredItems = const {},
    this.failNext,
    this.delay,
  });

  @override
  Future<List<Approval>> listApprovals({
    String? type,
    required String activeOrgId,
  }) async {
    listCalls += 1;
    lastOrgId = activeOrgId;
    lastType = type;
    if (delay != null) {
      await Future<void>.delayed(delay!);
    }
    if (failNext != null) {
      final msg = failNext!;
      throw ApprovalsException(msg);
    }
    if (type != null && filteredItems.containsKey(type)) {
      return filteredItems[type]!;
    }
    return items;
  }

  @override
  Future<Approval> getApproval(String id) async {
    return items.firstWhere((a) => a.id == id);
  }

  @override
  Future<void> approve(String id, {String? note}) async {
    approvedIds.add(id);
  }

  @override
  Future<void> reject(String id, {required String reason}) async {
    rejectedIds.add(id);
  }
}

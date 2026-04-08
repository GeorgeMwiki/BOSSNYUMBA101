import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:bossnyumba_app/core/api_client.dart';
import 'package:bossnyumba_app/core/org_provider.dart';
import 'package:bossnyumba_app/widgets/org_switcher.dart';

Widget _wrap(OrgProvider org, Widget child) {
  return ChangeNotifierProvider<OrgProvider>.value(
    value: org,
    child: MaterialApp(home: Scaffold(appBar: AppBar(actions: [child]))),
  );
}

void main() {
  group('OrgSwitcher', () {
    testWidgets('renders nothing when there are no orgs', (tester) async {
      final org = OrgProvider(api: ApiClient());
      await tester.pumpWidget(_wrap(org, const OrgSwitcher()));
      expect(find.byType(PopupMenuButton<String>), findsNothing);
      expect(find.byType(Chip), findsNothing);
    });

    testWidgets('renders a static chip when only one org is available',
        (tester) async {
      final org = OrgProvider(api: ApiClient())
        ..setAvailableOrgs([const Org(id: 't1', name: 'Sunrise Apts')]);
      await tester.pumpWidget(_wrap(org, const OrgSwitcher()));
      expect(find.byType(Chip), findsOneWidget);
      expect(find.text('Sunrise Apts'), findsOneWidget);
    });

    testWidgets('renders popup menu when multiple orgs exist and switches',
        (tester) async {
      final api = ApiClient();
      final org = OrgProvider(api: api)
        ..setAvailableOrgs([
          const Org(id: 'a', name: 'Acme'),
          const Org(id: 'b', name: 'Beta Holdings'),
        ]);

      await tester.pumpWidget(_wrap(org, const OrgSwitcher()));
      expect(find.byKey(const Key('org-switcher-menu')), findsOneWidget);

      await tester.tap(find.byKey(const Key('org-switcher-menu')));
      await tester.pumpAndSettle();

      expect(find.text('Beta Holdings'), findsOneWidget);
      await tester.tap(find.text('Beta Holdings').last);
      await tester.pumpAndSettle();

      expect(org.activeOrgId, 'b');
      expect(api.activeOrgIdProvider!(), 'b');
    });
  });

  group('ApiClient x-active-org header', () {
    test('includes X-Active-Org when org provider is wired', () {
      final api = ApiClient();
      OrgProvider(api: api).setAvailableOrgs([
        const Org(id: 'org-99', name: 'Ninety-Nine'),
      ]);
      // Use reflection via public getter: construct headers directly is not
      // possible (private), but we can verify the injected getter.
      expect(api.activeOrgIdProvider!(), 'org-99');
    });
  });
}

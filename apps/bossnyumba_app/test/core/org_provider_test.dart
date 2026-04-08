import 'package:flutter_test/flutter_test.dart';
import 'package:bossnyumba_app/core/api_client.dart';
import 'package:bossnyumba_app/core/org_provider.dart';

void main() {
  group('OrgProvider', () {
    late ApiClient api;
    late OrgProvider org;

    setUp(() {
      api = ApiClient();
      org = OrgProvider(api: api);
    });

    test('wires its active org id into ApiClient.activeOrgIdProvider', () {
      expect(api.activeOrgIdProvider, isNotNull);
      expect(api.activeOrgIdProvider!(), isNull);

      org.setAvailableOrgs([
        const Org(id: 'tenant-1', name: 'Tenant One'),
        const Org(id: 'tenant-2', name: 'Tenant Two'),
      ]);

      expect(api.activeOrgIdProvider!(), 'tenant-1');

      org.setActiveOrg('tenant-2');
      expect(api.activeOrgIdProvider!(), 'tenant-2');
    });

    test('setAvailableOrgs picks preferredActiveId when provided', () {
      org.setAvailableOrgs(
        [
          const Org(id: 'a', name: 'A'),
          const Org(id: 'b', name: 'B'),
        ],
        preferredActiveId: 'b',
      );
      expect(org.activeOrgId, 'b');
    });

    test('setAvailableOrgs resets active id when current is not in list', () {
      org.setAvailableOrgs([const Org(id: 'a', name: 'A')]);
      expect(org.activeOrgId, 'a');

      org.setAvailableOrgs([const Org(id: 'c', name: 'C')]);
      expect(org.activeOrgId, 'c');
    });

    test('setActiveOrg notifies listeners only when id changes', () {
      org.setAvailableOrgs([
        const Org(id: 'x', name: 'X'),
        const Org(id: 'y', name: 'Y'),
      ]);

      var calls = 0;
      org.addListener(() => calls++);

      org.setActiveOrg('x'); // no-op (already active)
      expect(calls, 0);

      org.setActiveOrg('y');
      expect(calls, 1);
    });

    test('clear empties state and notifies', () {
      org.setAvailableOrgs([const Org(id: 'a', name: 'A')]);
      var calls = 0;
      org.addListener(() => calls++);
      org.clear();
      expect(org.availableOrgs, isEmpty);
      expect(org.activeOrgId, isNull);
      expect(calls, 1);
    });

    test('Org.fromJson tolerates minimal payloads', () {
      final o = Org.fromJson({'id': 't1', 'name': 'T1'});
      expect(o.id, 't1');
      expect(o.name, 'T1');

      final o2 = Org.fromJson({'tenantId': 't2', 'slug': 'slug-2'});
      expect(o2.id, 't2');
      expect(o2.name, 'slug-2');
    });
  });
}

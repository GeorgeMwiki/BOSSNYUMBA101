import 'package:bossnyumba_core/rbac.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MobileRole', () {
    test('fromWire round-trip', () {
      for (final r in MobileRole.values) {
        expect(MobileRole.fromWire(r.wire), r);
      }
    });

    test('unknown wire returns null', () {
      expect(MobileRole.fromWire('NOT_A_ROLE'), isNull);
    });
  });

  group('MobileAccessPolicy', () {
    test('allowed roles are permitted', () {
      for (final r in MobileAccessPolicy.allowedRoles) {
        expect(MobileAccessPolicy.isRoleAllowed(r), isTrue);
      }
    });

    test('restricted permissions are blocked', () {
      for (final p in const ['auditlog.export', 'admin.manage_users']) {
        expect(MobileAccessPolicy.isPermissionAllowed(p), isFalse);
      }
    });

    test('unrestricted permissions are allowed', () {
      expect(MobileAccessPolicy.isPermissionAllowed('payment.view'), isTrue);
      expect(
          MobileAccessPolicy.isPermissionAllowed('maintenance.create'), isTrue);
    });

    test('offline expiry kicks in after maxOfflineHours', () {
      final old = DateTime.now().subtract(const Duration(hours: 100));
      expect(MobileAccessPolicy.isOfflineExpired(old), isTrue);
      final recent = DateTime.now().subtract(const Duration(hours: 10));
      expect(MobileAccessPolicy.isOfflineExpired(recent), isFalse);
    });
  });
}

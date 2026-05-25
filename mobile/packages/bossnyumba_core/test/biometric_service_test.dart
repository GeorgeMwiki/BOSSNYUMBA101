import 'package:bossnyumba_core/biometric_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('InMemoryBiometricService', () {
    late InMemoryBiometricService svc;

    setUp(() {
      svc = InMemoryBiometricService();
    });

    test('checkCapability returns the configured capability', () async {
      final c = await svc.checkCapability();
      expect(c.fingerprintAvailable, isTrue);
      expect(c.anyAvailable, isTrue);
    });

    test('isEnrolled is false until enroll succeeds', () async {
      expect(await svc.isEnrolled('user-1'), isFalse);
      final r = await svc.enroll(userId: 'user-1');
      expect(r.success, isTrue);
      expect(await svc.isEnrolled('user-1'), isTrue);
    });

    test('authenticate without enrolment returns requiresEnrollment',
        () async {
      final r = await svc.authenticate(userId: 'user-2');
      expect(r.success, isFalse);
      expect(r.requiresEnrollment, isTrue);
    });

    test('authenticate after enrolment respects prompt result', () async {
      await svc.enroll(userId: 'user-1');
      svc.nextPromptResult = false;
      final r = await svc.authenticate(userId: 'user-1');
      expect(r.success, isFalse);
      expect(r.requiresEnrollment, isFalse);
    });

    test('removeEnrollment forgets the user', () async {
      await svc.enroll(userId: 'user-1');
      await svc.removeEnrollment('user-1');
      expect(await svc.isEnrolled('user-1'), isFalse);
    });
  });
}

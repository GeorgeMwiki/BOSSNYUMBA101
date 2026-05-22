// ---------------------------------------------------------------------------
// integration_test/biometric_enroll_test.dart
// ---------------------------------------------------------------------------
// Biometric enrolment + authentication round-trip.
// ---------------------------------------------------------------------------

import 'package:bossnyumba_core/biometric_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('enroll then authenticate succeeds', (tester) async {
    final svc = InMemoryBiometricService();
    final cap = await svc.checkCapability();
    expect(cap.fingerprintAvailable, isTrue);

    expect(await svc.isEnrolled('manager-1'), isFalse);
    final enroll = await svc.enroll(userId: 'manager-1');
    expect(enroll.success, isTrue);
    expect(enroll.biometricType, 'fingerprint');

    final auth = await svc.authenticate(userId: 'manager-1');
    expect(auth.success, isTrue);
    expect(auth.requiresEnrollment, isFalse);
  });

  testWidgets('authentication of non-enrolled user requires enrolment',
      (tester) async {
    final svc = InMemoryBiometricService();
    final r = await svc.authenticate(userId: 'unknown');
    expect(r.success, isFalse);
    expect(r.requiresEnrollment, isTrue);
  });
}

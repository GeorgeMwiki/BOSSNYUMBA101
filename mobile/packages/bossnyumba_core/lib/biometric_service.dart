// ---------------------------------------------------------------------------
// biometric_service.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA biometric authentication service.
//
// What BELONGS in this file:
//   * `BiometricService` abstract contract wrapping `local_auth`.
//   * `BiometricCapability`, `BiometricEnrollResult`, `BiometricAuthResult`
//     value types.
//   * `InMemoryBiometricService` — deterministic implementation used in
//     tests and as the reference shape. Production code wires
//     `local_auth` + `flutter_secure_storage` in a sibling file.
//
// What does NOT belong here:
//   * Raw biometric template handling — the OS is the source of trust.
//     We only ever store a SHA-256 hash of `userId:deviceId:enrolToken`
//     in secure storage and on the backend.
//   * UI presentation — that lives in the consuming screen.
//
// Used by:
//   * `customer_mobile` — biometric lock for the rent-pay screen.
//   * `estate_manager_mobile` — biometric tenant lease sign-off (the
//     manager holds the device; the tenant presses their finger to sign).
// ---------------------------------------------------------------------------

import 'dart:async';

import 'package:meta/meta.dart';

/// What biometric methods the device can use.
@immutable
class BiometricCapability {
  const BiometricCapability({
    required this.fingerprintAvailable,
    required this.faceAvailable,
    required this.irisAvailable,
    required this.deviceSupported,
  });

  final bool fingerprintAvailable;
  final bool faceAvailable;
  final bool irisAvailable;
  final bool deviceSupported;

  bool get anyAvailable =>
      fingerprintAvailable || faceAvailable || irisAvailable;
}

/// Outcome of an enrolment attempt.
@immutable
class BiometricEnrollResult {
  const BiometricEnrollResult({
    required this.success,
    this.biometricType,
    this.error,
  });

  final bool success;
  final String? biometricType;
  final String? error;
}

/// Outcome of an authentication attempt.
@immutable
class BiometricAuthResult {
  const BiometricAuthResult({
    required this.success,
    this.error,
    this.requiresEnrollment = false,
  });

  final bool success;
  final String? error;
  final bool requiresEnrollment;
}

/// Abstract biometric service contract.
abstract class BiometricService {
  Future<BiometricCapability> checkCapability();
  Future<bool> isAvailable();
  Future<bool> isEnrolled(String userId);

  Future<BiometricEnrollResult> enroll({
    required String userId,
    String biometricType,
  });

  Future<BiometricAuthResult> authenticate({required String userId});
  Future<bool> prompt({required String reason});
  Future<void> removeEnrollment(String userId);
}

/// In-memory biometric service for tests + dev.
///
/// Reflects an enrolment record in memory only. Real implementation
/// wraps `local_auth` for OS prompts and `flutter_secure_storage`
/// for token persistence.
class InMemoryBiometricService implements BiometricService {
  InMemoryBiometricService({
    BiometricCapability capability = const BiometricCapability(
      fingerprintAvailable: true,
      faceAvailable: false,
      irisAvailable: false,
      deviceSupported: true,
    ),
    bool promptResult = true,
  })  : _capability = capability,
        _promptResult = promptResult;

  final BiometricCapability _capability;
  bool _promptResult;
  final Set<String> _enrolled = <String>{};

  /// Test-only: flip what the next prompt returns.
  set nextPromptResult(bool value) => _promptResult = value;

  @override
  Future<BiometricCapability> checkCapability() async => _capability;

  @override
  Future<bool> isAvailable() async => _capability.anyAvailable;

  @override
  Future<bool> isEnrolled(String userId) async => _enrolled.contains(userId);

  @override
  Future<BiometricEnrollResult> enroll({
    required String userId,
    String biometricType = 'fingerprint',
  }) async {
    if (!_capability.anyAvailable) {
      return const BiometricEnrollResult(
        success: false,
        error: 'no biometric available on device',
      );
    }
    _enrolled.add(userId);
    return BiometricEnrollResult(
      success: true,
      biometricType: biometricType,
    );
  }

  @override
  Future<BiometricAuthResult> authenticate({required String userId}) async {
    if (!_enrolled.contains(userId)) {
      return const BiometricAuthResult(
        success: false,
        requiresEnrollment: true,
        error: 'user not enrolled on this device',
      );
    }
    return BiometricAuthResult(
      success: _promptResult,
      error: _promptResult ? null : 'user cancelled or biometric mismatch',
    );
  }

  @override
  Future<bool> prompt({required String reason}) async => _promptResult;

  @override
  Future<void> removeEnrollment(String userId) async {
    _enrolled.remove(userId);
  }
}

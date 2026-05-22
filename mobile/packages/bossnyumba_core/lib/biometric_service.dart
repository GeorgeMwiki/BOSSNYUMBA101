// ---------------------------------------------------------------------------
// biometric_service.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA biometric authentication service.
//
// What BELONGS in this file:
//   * Abstract `BiometricService` contract wrapping `local_auth`.
//   * `BiometricCapability` value object describing what the device
//     supports (fingerprint / face / iris).
//   * Result types for enrollment and authentication.
//   * Documentation of the enrolment-token-hash protocol so the
//     backend pair can verify without storing raw biometric data.
//
// What does NOT belong here:
//   * Raw biometric template handling — the OS is the source of trust.
//     We only ever store a SHA-256 hash of `userId:deviceId:enrolToken`
//     in secure storage and on the backend.
//   * UI presentation (PIN-fallback dialogs, etc.) — those go in the
//     consuming screen, not this service.
//
// Used by:
//   * `customer_mobile` — biometric lock for the rent-pay screen.
//   * `estate_manager_mobile` — biometric tenant lease sign-off (the
//     manager holds the device; the tenant presses their finger to sign).
// ---------------------------------------------------------------------------

/// What biometric methods the device can use.
class BiometricCapability {
  final bool fingerprintAvailable;
  final bool faceAvailable;
  final bool irisAvailable;
  final bool deviceSupported;

  const BiometricCapability({
    required this.fingerprintAvailable,
    required this.faceAvailable,
    required this.irisAvailable,
    required this.deviceSupported,
  });

  bool get anyAvailable =>
      fingerprintAvailable || faceAvailable || irisAvailable;
}

/// Outcome of an enrolment attempt.
class BiometricEnrollResult {
  final bool success;
  final String? biometricType;
  final String? error;

  const BiometricEnrollResult({
    required this.success,
    this.biometricType,
    this.error,
  });
}

/// Outcome of an authentication attempt.
class BiometricAuthResult {
  final bool success;
  final String? error;
  final bool requiresEnrollment;

  const BiometricAuthResult({
    required this.success,
    this.error,
    this.requiresEnrollment = false,
  });
}

/// Abstract biometric service contract.
///
/// Concrete implementation wraps `package:local_auth` for OS prompts,
/// `flutter_secure_storage` for enrollment-token persistence, and posts
/// `enrollment_token_hash` to the backend `/biometric` endpoint.
abstract class BiometricService {
  /// Probe what the device can do.
  Future<BiometricCapability> checkCapability() {
    throw UnimplementedError(
      'checkCapability() must be implemented by BiometricService subclasses',
    );
  }

  /// True if the OS has at least one usable biometric method available.
  Future<bool> isAvailable() {
    throw UnimplementedError(
      'isAvailable() must be implemented by BiometricService subclasses',
    );
  }

  /// True if this user has previously enrolled on this device.
  Future<bool> isEnrolled(String userId) {
    throw UnimplementedError(
      'isEnrolled() must be implemented by BiometricService subclasses',
    );
  }

  /// Enrol the device for [userId].
  ///
  /// Workflow:
  ///   1. Prompt OS biometric.
  ///   2. Generate a per-device enrolment token (UUID v4).
  ///   3. Hash `userId:deviceId:token` with SHA-256.
  ///   4. POST the hash to the backend `/biometric` (action=enroll).
  ///   5. Persist the raw token in `flutter_secure_storage`.
  Future<BiometricEnrollResult> enroll({
    required String userId,
    String biometricType = 'fingerprint',
  }) {
    throw UnimplementedError(
      'enroll() must be implemented by BiometricService subclasses',
    );
  }

  /// Authenticate [userId] using their enrolled biometric.
  ///
  /// Workflow:
  ///   1. Prompt OS biometric.
  ///   2. Read enrolment token from secure storage.
  ///   3. Re-hash and POST to backend `/biometric` (action=verify).
  Future<BiometricAuthResult> authenticate({required String userId}) {
    throw UnimplementedError(
      'authenticate() must be implemented by BiometricService subclasses',
    );
  }

  /// Thin OS-prompt wrapper for callers that only need a yes/no
  /// (e.g. confirming a payment). Does NOT touch the backend.
  Future<bool> prompt({required String reason}) {
    throw UnimplementedError(
      'prompt() must be implemented by BiometricService subclasses',
    );
  }

  /// Remove enrolment from this device (e.g. on logout).
  Future<void> removeEnrollment(String userId) {
    throw UnimplementedError(
      'removeEnrollment() must be implemented by BiometricService subclasses',
    );
  }
}

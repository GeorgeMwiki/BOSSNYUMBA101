import 'dart:io';

/// Lightweight abstractions for platform media pickers used by the owner
/// quick-report flow. These exist so the screen can be built and tested today
/// without pulling `image_picker`, `record`, or `geolocator` into
/// `pubspec.yaml` — wire in a concrete implementation inside `main.dart` (or
/// a DI container) once those packages are added.
///
/// The stub implementations defined here never succeed; the UI handles this
/// gracefully so the overall flow still works even on a device missing the
/// hardware adapter.

/// Picks photos from camera or gallery. Returns an empty list if cancelled
/// or unsupported.
abstract class QuickReportPhotoPicker {
  /// Prompt the user for a photo. [fromCamera] selects the source — camera
  /// when true, gallery when false.
  Future<File?> pickOne({required bool fromCamera});
}

/// No-op photo picker used as the default when `image_picker` is absent.
class StubPhotoPicker implements QuickReportPhotoPicker {
  const StubPhotoPicker();

  @override
  Future<File?> pickOne({required bool fromCamera}) async => null;
}

/// Controls audio capture for the voice-note step.
abstract class QuickReportVoiceRecorder {
  Future<bool> hasPermission();

  /// Begins recording. Implementations should write to a temp file and later
  /// return its [File] from [stop].
  Future<void> start();

  /// Stops the current recording and returns the file. Returns `null` if
  /// nothing was captured.
  Future<File?> stop();

  /// Aborts a recording in progress and discards any temp file.
  Future<void> cancel();

  /// Whether a recording is currently in progress.
  bool get isRecording;
}

/// No-op recorder used as the default when `record` is absent.
class StubVoiceRecorder implements QuickReportVoiceRecorder {
  bool _recording = false;

  @override
  Future<bool> hasPermission() async => false;

  @override
  Future<void> start() async {
    _recording = true;
  }

  @override
  Future<File?> stop() async {
    _recording = false;
    return null;
  }

  @override
  Future<void> cancel() async {
    _recording = false;
  }

  @override
  bool get isRecording => _recording;
}

/// Lat/lng pair captured from the device GPS.
class GpsFix {
  final double latitude;
  final double longitude;
  final DateTime takenAt;

  const GpsFix({
    required this.latitude,
    required this.longitude,
    required this.takenAt,
  });

  Map<String, dynamic> toJson() => {
        'lat': latitude,
        'lng': longitude,
        'takenAt': takenAt.toIso8601String(),
      };
}

/// Optional GPS probe. The quick-report flow calls [probe] at submit time; a
/// `null` return means permission was denied, the feature is unsupported, or
/// no fix was available in time — all of which we tolerate silently.
abstract class GpsProbe {
  Future<GpsFix?> probe();
}

/// No-op GPS probe used when `geolocator` is absent.
class StubGpsProbe implements GpsProbe {
  const StubGpsProbe();

  @override
  Future<GpsFix?> probe() async => null;
}

// ---------------------------------------------------------------------------
// connectivity_monitor.dart
// ---------------------------------------------------------------------------
// BOSSNYUMBA network reachability monitor.
//
// What BELONGS in this file:
//   * `ConnectivityMonitor` abstract contract.
//   * `DefaultConnectivityMonitor` concrete implementation that combines
//     the link-layer signal (port: `LinkSignalSource`, prod -> `connectivity_plus`)
//     with an active HEAD-probe (port: `HealthProbe`, prod -> http HEAD
//     against `/api/health` with a 5s timeout).
//
//     In Tanzania (and many emerging markets) a cellular bar does not
//     mean the device can talk to our API. Implementations MUST perform
//     a HEAD request to `${apiBaseUrl}/api/health` before declaring the
//     device online.
//
// What does NOT belong here:
//   * Sync replay logic — that lives in `sync_engine.dart` and listens
//     to this monitor's stream.
//   * UI banners — they subscribe to `onConnectivityChanged` from the
//     UI layer.
// ---------------------------------------------------------------------------

import 'dart:async';

/// High-level reachability state.
enum ConnectivityState {
  /// Device can reach `/api/health`. Sync may proceed.
  online,

  /// Device shows link-layer signal but `/api/health` is unreachable
  /// (DNS dead, captive-portal, ISP blocking, server outage). Sync MUST
  /// NOT proceed — TZ networks frequently report a cellular bar with
  /// no actual route to our API.
  linkOnlyNoApi,

  /// No link-layer signal at all (airplane mode / no SIM / no Wi-Fi).
  offline,

  /// Reachability has not yet been determined (cold start).
  unknown,
}

/// Source of link-layer signal — fed from `connectivity_plus` in
/// production, or a fake stream in tests.
abstract class LinkSignalSource {
  /// True when the OS reports a connected interface (Wi-Fi, mobile,
  /// ethernet). DOES NOT imply actual API reachability.
  bool get hasLink;

  /// Broadcast stream of link-layer transitions.
  Stream<bool> get changes;

  /// Refresh by querying the platform synchronously.
  Future<bool> refresh();
}

/// Active probe against the API health endpoint.
abstract class HealthProbe {
  /// Issue a HEAD request against `/api/health` with a hard 5s timeout.
  /// Returns true ⇔ the server replied with 2xx.
  Future<bool> ping();
}

/// Abstract connectivity monitor.
abstract class ConnectivityMonitor {
  bool get isOnline;
  ConnectivityState get currentState;

  Stream<ConnectivityState> get onConnectivityChanged;

  Future<void> initialize();
  Future<bool> checkNow();
  void dispose();
}

/// Default connectivity monitor.
///
/// Behaviour:
///   1. Subscribe to [LinkSignalSource.changes]. On link-down, immediately
///      flip to [ConnectivityState.offline]. On link-up, kick off a
///      [HealthProbe.ping] before declaring [ConnectivityState.online].
///   2. Re-probe periodically (every 30 seconds by default) so we
///      detect TZ "carrier lies" — link stays up but the API has
///      become unreachable.
///   3. Expose `Stream<ConnectivityState>` for the sync engine and UI.
class DefaultConnectivityMonitor implements ConnectivityMonitor {
  DefaultConnectivityMonitor({
    required LinkSignalSource linkSource,
    required HealthProbe healthProbe,
    Duration rePollInterval = const Duration(seconds: 30),
  })  : _linkSource = linkSource,
        _healthProbe = healthProbe,
        _rePollInterval = rePollInterval;

  final LinkSignalSource _linkSource;
  final HealthProbe _healthProbe;
  final Duration _rePollInterval;

  final StreamController<ConnectivityState> _controller =
      StreamController<ConnectivityState>.broadcast();

  StreamSubscription<bool>? _linkSub;
  Timer? _poll;
  ConnectivityState _state = ConnectivityState.unknown;
  bool _initialized = false;
  bool _disposed = false;

  @override
  bool get isOnline => _state == ConnectivityState.online;

  @override
  ConnectivityState get currentState => _state;

  @override
  Stream<ConnectivityState> get onConnectivityChanged => _controller.stream;

  @override
  Future<void> initialize() async {
    if (_initialized || _disposed) return;
    _initialized = true;

    _linkSub = _linkSource.changes.listen(_onLinkChange);

    // Initial probe so the first emitted state is meaningful.
    await checkNow();

    // Re-poll on a timer so we detect TZ "carrier lies".
    _poll = Timer.periodic(_rePollInterval, (_) {
      // Discard the bool return — we only use checkNow for its side effect
      // of emitting on the stream.
      unawaited(checkNow().then((_) {}));
    });
  }

  @override
  Future<bool> checkNow() async {
    if (_disposed) return false;
    final hasLink = await _linkSource.refresh();
    if (!hasLink) {
      _emit(ConnectivityState.offline);
      return false;
    }
    final apiReachable = await _safePing();
    _emit(apiReachable
        ? ConnectivityState.online
        : ConnectivityState.linkOnlyNoApi);
    return apiReachable;
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _poll?.cancel();
    _poll = null;
    final sub = _linkSub;
    _linkSub = null;
    if (sub != null) {
      unawaited(sub.cancel());
    }
    _controller.close();
  }

  // ── internal ───────────────────────────────────────────────────────────

  Future<void> _onLinkChange(bool hasLink) async {
    if (!hasLink) {
      _emit(ConnectivityState.offline);
      return;
    }
    final apiReachable = await _safePing();
    _emit(apiReachable
        ? ConnectivityState.online
        : ConnectivityState.linkOnlyNoApi);
  }

  Future<bool> _safePing() async {
    try {
      return await _healthProbe.ping();
    } on Object {
      return false;
    }
  }

  void _emit(ConnectivityState next) {
    if (_state == next) return;
    _state = next;
    if (!_controller.isClosed) {
      _controller.add(next);
    }
  }
}

/// In-memory fake [LinkSignalSource] for tests.
class FakeLinkSignalSource implements LinkSignalSource {
  FakeLinkSignalSource({bool initial = true}) : _hasLink = initial;

  final StreamController<bool> _ctrl = StreamController<bool>.broadcast();
  bool _hasLink;

  @override
  bool get hasLink => _hasLink;

  @override
  Stream<bool> get changes => _ctrl.stream;

  @override
  Future<bool> refresh() async => _hasLink;

  /// Test API: simulate the OS toggling link state.
  void emit(bool hasLink) {
    _hasLink = hasLink;
    _ctrl.add(hasLink);
  }

  Future<void> close() async {
    await _ctrl.close();
  }
}

/// In-memory fake [HealthProbe] for tests.
class FakeHealthProbe implements HealthProbe {
  FakeHealthProbe({bool reachable = true}) : _reachable = reachable;

  bool _reachable;
  int callCount = 0;
  Object? throwOnNext;

  set reachable(bool value) => _reachable = value;
  bool get reachable => _reachable;

  @override
  Future<bool> ping() async {
    callCount += 1;
    final err = throwOnNext;
    if (err != null) {
      throwOnNext = null;
      throw err;
    }
    return _reachable;
  }
}

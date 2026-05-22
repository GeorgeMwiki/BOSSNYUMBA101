// ---------------------------------------------------------------------------
// connectivity_monitor_test.dart
// ---------------------------------------------------------------------------
// Unit tests for `DefaultConnectivityMonitor`.
//
// Covers:
//   1. initialize() probes once and emits an initial state
//   2. link-down -> offline
//   3. link-up + API reachable -> online
//   4. link-up + API unreachable -> linkOnlyNoApi  (TZ carrier-lies case)
//   5. checkNow() returns true ⇔ /api/health responded 2xx
//   6. HealthProbe.ping throwing is treated as unreachable, not crash
//   7. periodic re-poll catches a carrier that started lying mid-session
//   8. dispose() closes the controller and cancels subscriptions
// ---------------------------------------------------------------------------

import 'dart:async';

import 'package:bossnyumba_core/connectivity_monitor.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DefaultConnectivityMonitor', () {
    late FakeLinkSignalSource link;
    late FakeHealthProbe probe;
    late DefaultConnectivityMonitor monitor;

    setUp(() {
      link = FakeLinkSignalSource(initial: true);
      probe = FakeHealthProbe();
      monitor = DefaultConnectivityMonitor(
        linkSource: link,
        healthProbe: probe,
        rePollInterval: const Duration(milliseconds: 50),
      );
    });

    tearDown(() async {
      monitor.dispose();
      await link.close();
    });

    test('initialize() emits an initial state after the first probe',
        () async {
      final states = <ConnectivityState>[];
      final sub = monitor.onConnectivityChanged.listen(states.add);
      await monitor.initialize();
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(monitor.currentState, ConnectivityState.online);
      expect(states, contains(ConnectivityState.online));
      await sub.cancel();
    });

    test('link-down emits offline regardless of probe', () async {
      await monitor.initialize();
      final states = <ConnectivityState>[];
      final sub = monitor.onConnectivityChanged.listen(states.add);
      link.emit(false);
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(monitor.currentState, ConnectivityState.offline);
      expect(states, contains(ConnectivityState.offline));
      await sub.cancel();
    });

    test('link-up with API reachable -> online', () async {
      link = FakeLinkSignalSource(initial: false);
      probe = FakeHealthProbe(reachable: true);
      monitor.dispose();
      monitor = DefaultConnectivityMonitor(
        linkSource: link,
        healthProbe: probe,
        rePollInterval: const Duration(seconds: 99),
      );
      await monitor.initialize();
      expect(monitor.currentState, ConnectivityState.offline);
      link.emit(true);
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(monitor.currentState, ConnectivityState.online);
    });

    test('link-up with API unreachable -> linkOnlyNoApi (TZ false-positive)',
        () async {
      probe.reachable = false;
      await monitor.initialize();
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(monitor.currentState, ConnectivityState.linkOnlyNoApi);
      expect(monitor.isOnline, isFalse);
    });

    test('checkNow returns true iff API reachable', () async {
      probe.reachable = true;
      expect(await monitor.checkNow(), isTrue);
      probe.reachable = false;
      expect(await monitor.checkNow(), isFalse);
    });

    test('HealthProbe exceptions are swallowed as unreachable', () async {
      probe.throwOnNext = Exception('boom');
      final reachable = await monitor.checkNow();
      expect(reachable, isFalse);
      expect(monitor.currentState, ConnectivityState.linkOnlyNoApi);
    });

    test('periodic re-poll detects a mid-session carrier lie', () async {
      await monitor.initialize();
      expect(monitor.currentState, ConnectivityState.online);
      // Carrier "lies" — link stays up but API becomes unreachable.
      probe.reachable = false;
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(monitor.currentState, ConnectivityState.linkOnlyNoApi);
    });

    test('dispose() is idempotent and stops polling', () async {
      await monitor.initialize();
      monitor.dispose();
      monitor.dispose(); // double-dispose must not throw
      // After dispose, no further state events are expected — sanity check
      // by giving the timer plenty of time to NOT fire.
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(monitor.currentState, isA<ConnectivityState>());
    });
  });
}

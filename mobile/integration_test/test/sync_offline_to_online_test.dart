// ---------------------------------------------------------------------------
// integration_test/sync_offline_to_online_test.dart
// ---------------------------------------------------------------------------
// Queue 3 mutations while offline, regain connectivity, verify drain
// order (payment first) and outbox is empty.
// ---------------------------------------------------------------------------

import 'dart:async';

import 'package:bossnyumba_core/sync_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('offline queue drains in priority order when back online',
      (tester) async {
    final outbox = InMemoryOutboxStore();
    final transport = FakeSyncTransport();
    final online = StreamController<bool>.broadcast();
    var i = 0;
    final engine = DefaultSyncEngine(
      outbox: outbox,
      transport: transport,
      onlineStream: online.stream,
      idGenerator: () => 'mut-${++i}',
      nowEpochMs: () => 1000 * i,
    );
    await engine.start();

    // Queue OFFLINE.
    await engine.queueMutation(
      entity: SyncEntity.maintenanceTicket,
      url: '/api/maintenance',
      method: 'POST',
    );
    await engine.queueMutation(
      entity: SyncEntity.payment,
      url: '/api/payments',
      method: 'POST',
      body: '{"amount":250000}',
    );
    await engine.queueMutation(
      entity: SyncEntity.lease,
      url: '/api/leases/sign',
      method: 'POST',
    );
    expect(transport.sent, isEmpty);
    expect(await outbox.count(), 3);

    // Regain connectivity.
    online.add(true);
    // Let the listener fire.
    await Future<void>.delayed(const Duration(milliseconds: 20));

    expect(transport.sent.first.entity, SyncEntity.payment);
    expect(transport.sent[1].entity, SyncEntity.lease);
    expect(transport.sent.last.entity, SyncEntity.maintenanceTicket);
    expect(await outbox.count(), 0);

    engine.dispose();
    await online.close();
  });
}

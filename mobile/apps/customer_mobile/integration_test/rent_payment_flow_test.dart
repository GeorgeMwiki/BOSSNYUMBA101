// Mirror of `mobile/integration_test/rent_payment_flow_test.dart`.
// Per-app location is required by `flutter test integration_test/...`.

import 'dart:async';

import 'package:bossnyumba_core/sync_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('rent payment queues with idempotency key and drains',
      (tester) async {
    final outbox = InMemoryOutboxStore();
    final transport = FakeSyncTransport();
    final online = StreamController<bool>.broadcast();
    final engine = DefaultSyncEngine(
      outbox: outbox,
      transport: transport,
      onlineStream: online.stream,
      idGenerator: () => 'mpesa-stk-uuid',
    );
    await engine.start();

    await engine.queueMutation(
      entity: SyncEntity.payment,
      url: '/api/payments/mpesa/stk-push',
      method: 'POST',
      body: '{"leaseId":"L-1","amount":250000,"phone":"+255700000001"}',
    );
    final pending = await outbox.listAll();
    expect(pending.first.headers!['idempotency-key'], 'mpesa-stk-uuid');

    online.add(true);
    await Future<void>.delayed(const Duration(milliseconds: 20));

    expect(transport.sent.first.url, '/api/payments/mpesa/stk-push');
    expect(await outbox.count(), 0);

    engine.dispose();
    await online.close();
  });
}
